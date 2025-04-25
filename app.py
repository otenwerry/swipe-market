from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from datetime import datetime, time 
import time as time_module
import random
import os
import requests
import json
import boto3
import string
import pytz
from  flask_sqlalchemy import SQLAlchemy
from flask import make_response, g, render_template, flash
from flask import session, flash, redirect, url_for
from flask_mail import Mail, Message
from flask_migrate import Migrate
from google.oauth2 import id_token
from google.auth.transport.requests import Request as GoogleRequest
from functools import wraps
from smtplib import SMTPException

app = Flask(__name__) #sets up a flask application
#csrf = CSRFProtect(app)
app.secret_key = os.environ.get('SECRET_KEY','fallback-secret-key') 
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') # for PostgreSQL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_DEFAULT_SENDER'] = 'liondinecu@gmail.com'
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True, 
    SESSION_COOKIE_SAMESITE='Lax'
)
mail = Mail(app)
migrate = Migrate(app, db)

ny_tz = pytz.timezone('America/New_York')

#VALIDATION FUNCTIONS

def validate_email_domain(email):
    """Validate that the email is from columbia.edu or barnard.edu domain."""
    if not email:
        return False
    email = email.lower()
    return email.endswith('@columbia.edu') or email.endswith('@barnard.edu')

def is_uni_banned(uni):
    """Check if a UNI is banned."""
    if not uni:
        return False
    # Get banned UNIs from environment variable
    banned_unis_str = os.environ.get('BANNED_UNIS', '')
    banned_unis = [u.strip().lower() for u in banned_unis_str.split(',')] if banned_unis_str else []
    return uni.lower() in banned_unis

# Extract UNI from an email address
def extract_uni(email):
    if not email:
        return None
    
    # Columbia/Barnard emails are in format uni@columbia.edu or uni@barnard.edu
    if '@columbia.edu' in email or '@barnard.edu' in email:
        return email.split('@')[0].lower()
    
    return None


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_email' not in session:
            flash('Please sign in to continue', 'error')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated

#DB MODEL CLASSES

#class for seller listings
class SellerListing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Store multiple dining halls as a comma-separated string.
    dining_hall = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String(100), nullable=False)
    start_time = db.Column(db.String(100), nullable=False)
    end_time = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    payment_methods = db.Column(db.String(200), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref='seller_listings')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(ny_tz))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self):
        return f'<SellerListing {self.id} - {self.user.name}>'

#class for buyer listings
class BuyerListing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # Store multiple dining halls as a comma-separated string.
    dining_hall = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String(100), nullable=False)
    start_time = db.Column(db.String(100), nullable=False)
    end_time = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    payment_methods = db.Column(db.String(200), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref='buyer_listings')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(ny_tz))
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self):
        return f'<BuyerListing {self.id} - {self.user.name}>'

# model to store user information
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    phone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(ny_tz))
    
    def __repr__(self):
        return f'<User {self.id} - {self.name}>'

# model to store contact records
class ContactRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, nullable=False)
    listing_type = db.Column(db.String(10), nullable=False)  # "seller" or "buyer"
    user_email = db.Column(db.String(100), nullable=False)
    contact_time = db.Column(db.DateTime, default=datetime.now(ny_tz))

    def __repr__(self):
        return f'<ContactRecord {self.id} - {self.user_email} contacted {self.listing_type} {self.listing_id}>'

# model to store blocked users
class BlockedUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    blocker_uni = db.Column(db.String(20), nullable=False)
    blocked_uni = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(ny_tz))
    
    # Ensure a user can't block the same UNI twice
    __table_args__ = (
        db.UniqueConstraint('blocker_uni', 'blocked_uni', name='unique_block'),
    )
    
    def __repr__(self):
        return f'<BlockedUser {self.id} - {self.blocker_uni} blocked {self.blocked_uni}>'




#SOME OTHER SHIT


# function to format time from 24-hour to 12-hour format with AM/PM
def format_time_to_12hour(time_str):
    # Return early if the time_str is empty or invalid
    if not time_str or ':' not in time_str:
        return time_str
    
    try:
        # Parse the time string
        hours, minutes = map(int, time_str.split(':'))
        
        # Determine period and convert hour to 12-hour format
        period = 'pm' if hours >= 12 else 'am'
        hour12 = hours % 12
        if hour12 == 0:
            hour12 = 12  # 0 hours in 24-hour time is 12 AM
            
        # Format the result
        return f"{hour12}:{minutes:02d} {period}"
    except (ValueError, TypeError):
        # Return the original string if parsing fails
        return time_str

# Function to format date without year (YYYY-MM-DD -> Month Day)
def format_date_without_year(date_str):
    # Return early if the date_str is empty or invalid
    if not date_str or '-' not in date_str:
        return date_str
    
    try:
        # Parse the date string
        from datetime import datetime
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        
        # Format to "Month Day" (e.g., "January 15")
        return date_obj.strftime("%B %d")
    except (ValueError, TypeError):
        # Return the original string if parsing fails
        return date_str

# Update expired listings: sets is_active to False for listings whose end time has passed
def update_expired_listings():
    now = datetime.now(ny_tz)
    
    # Update SellerListings
    active_sellers = SellerListing.query.filter_by(is_active=True).all()
    for listing in active_sellers:
        try:
            expiration_str = f"{listing.date} {listing.end_time}"
            expiration = datetime.strptime(expiration_str, "%Y-%m-%d %H:%M")
            expiration = ny_tz.localize(expiration)
            
            if now > expiration:
                listing.is_active = False
            else:
                pass
        except Exception as e:
            print(f"Error updating SellerListing {listing.id}: {e}")
            # Continue with next listing
    
    # Update BuyerListings
    active_buyers = BuyerListing.query.filter_by(is_active=True).all()
    for listing in active_buyers:
        try:
            expiration_str = f"{listing.date} {listing.end_time}"
            expiration = datetime.strptime(expiration_str, "%Y-%m-%d %H:%M")
            expiration = ny_tz.localize(expiration)
            
            if now > expiration:
                listing.is_active = False
        except Exception as e:
            print(f"Error updating BuyerListing {listing.id}: {e}")
            # Continue with next listing

    #commit changes to database
    db.session.commit()


# PAGE ROUTES
@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    token = request.json.get('id_token')
    try:
        # Verify the token's integrity & claims
        idinfo = id_token.verify_oauth2_token(
            token,
            GoogleRequest(),
            os.environ['GOOGLE_CLIENT_ID']
        )
        # Ensure it's from a Columbia/Barnard account
        email = idinfo['email']
        if not (email.endswith('@columbia.edu') or email.endswith('@barnard.edu')):
            raise ValueError("Unauthorized domain")

        session['user_id'] = idinfo['sub']
        session['user_email'] = email
        session.permanent = True
        return jsonify(success=True)
    except ValueError as e:
        # Invalid token or wrong audience/domain
        return jsonify(success=False, error=str(e)), 401
#regular route for the Swipe Market page
@app.route('/')
def index():
    update_expired_listings()
    # Convert string date and time to datetime for sorting
    def get_sort_key(listing):
        try:
            # Primary sort: date and start time
            date_str = listing.date
            time_str = listing.start_time
            start_time = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            
            # Secondary sort: end time
            end_time = datetime.strptime(listing.end_time, "%H:%M").time()
            
            # Tertiary sort: price (lower prices first)
            price = float(listing.price) if listing.price is not None else float('inf')
            
            return (start_time, end_time, price)
        except:
            return (datetime.max, time.max, float('inf'))  # Put invalid entries at the end

    # Get all active listings
    seller_listings = SellerListing.query.filter_by(is_active=True).all()
    buyer_listings = BuyerListing.query.filter_by(is_active=True).all()

    #try to get user email
    current_user_email = request.args.get('email') or session.get('user_email')
    
    
    if current_user_email:
        current_user_uni = extract_uni(current_user_email)
        
        if current_user_uni:
            # Get lists of UNIs that the current user has blocked and that have blocked the current user
            blocked_by_user = [block.blocked_uni for block in BlockedUser.query.filter_by(blocker_uni=current_user_uni).all()]
            blocked_user = [block.blocker_uni for block in BlockedUser.query.filter_by(blocked_uni=current_user_uni).all()]
            
            # Combine both lists to get all UNIs that should be filtered out
            all_blocked_unis = set(blocked_by_user + blocked_user)
            # Filter seller listings
            filtered_seller_listings = []
            for listing in seller_listings:
                seller_uni = extract_uni(listing.user.email)
                if seller_uni not in all_blocked_unis:
                    filtered_seller_listings.append(listing)
            
            # Filter buyer listings
            filtered_buyer_listings = []
            for listing in buyer_listings:
                buyer_uni = extract_uni(listing.user.email)
                if buyer_uni not in all_blocked_unis:
                    filtered_buyer_listings.append(listing)
            
            seller_listings = filtered_seller_listings
            buyer_listings = filtered_buyer_listings
    
    # Sort listings by multiple criteria
    seller_listings = sorted(seller_listings, key=get_sort_key)
    buyer_listings = sorted(buyer_listings, key=get_sort_key)
    
    # Format dates and times for display
    for listing in seller_listings:
        listing.date = format_date_without_year(listing.date)
        listing.start_time = format_time_to_12hour(listing.start_time)
        listing.end_time = format_time_to_12hour(listing.end_time)
    
    for listing in buyer_listings:
        listing.date = format_date_without_year(listing.date)
        listing.start_time = format_time_to_12hour(listing.start_time)
        listing.end_time = format_time_to_12hour(listing.end_time)
    
    # Create a response
    response = make_response(render_template('index.html', seller_listings=seller_listings, buyer_listings=buyer_listings))
    
   #if we have a user email, persist it in the session only
    if current_user_email:
        session['user_email'] = current_user_email

    return response



@app.route('/edit_listing/<int:listing_id>', methods=['GET', 'POST'])
@login_required
def edit_listing(listing_id):
    user_email = session['user_email']
    # Get the listing type from query param (GET) or form data (POST)
    listing_type = request.args.get('listing_type') if request.method == 'GET' else request.form.get('listing_type')
    
    # Check if UNI is banned
    user_uni = extract_uni(user_email)
    if user_uni and is_uni_banned(user_uni):
        flash("Error: Your account has been banned.", "error")
        return redirect(url_for('index'))
    
    if not listing_type or listing_type not in ['seller', 'buyer']:
        return "Invalid listing type - must be 'seller' or 'buyer'", 400

    # Get the listing based on the specified type
    if listing_type == 'seller':
        listing = SellerListing.query.get_or_404(listing_id)
        is_seller = True
        owner_email = listing.user.email
    else:  # listing_type == 'buyer'
        listing = BuyerListing.query.get_or_404(listing_id)
        is_seller = False
        owner_email = listing.user.email

    # Check if the user owns the listing (case insensitive comparison)
    if (is_seller and listing.user.email.lower() != user_email.lower()) or \
       (not is_seller and listing.user.email.lower() != user_email.lower()):
        return redirect(url_for('index'))
        
    if request.method == 'POST' and 'dining_hall[]' in request.form:
        
        # Validate dining halls
        dining_halls = request.form.getlist('dining_hall[]')
        if not dining_halls:
            flash("Error: Please select at least one dining hall.", "error")
            return render_template('edit_listing.html', listing=listing, is_seller=is_seller, listing_type=listing_type)
            
        # Validate payment methods
        payment_methods_list = request.form.getlist('payment_methods[]')
        if not payment_methods_list:
            flash("Error: Please select at least one payment method.", "error")
            return render_template('edit_listing.html', listing=listing, is_seller=is_seller, listing_type=listing_type)
            
        # Update the listing with new values
        listing.dining_hall = ", ".join(dining_halls)
        listing.date = request.form.get('date')
        listing.start_time = request.form.get('start_time')
        listing.end_time = request.form.get('end_time')
        try:
            listing.price = float(request.form.get('price'))
            if listing.price < 0:
                flash("Error: Price cannot be negative.", "error")
                return render_template('edit_listing.html', listing=listing, is_seller=is_seller, listing_type=listing_type)
        except (ValueError, TypeError):
            flash("Error: Please enter a valid price (number).", "error")
            return render_template('edit_listing.html', listing=listing, is_seller=is_seller, listing_type=listing_type)
        
        listing.payment_methods = ", ".join(payment_methods_list)
        
        try:
            db.session.commit()
            return redirect(url_for('index'))
        except Exception as e:
            db.session.rollback()
            return "Error updating listing", 500

    # Show the edit form for both GET requests and initial POST verification
    return render_template('edit_listing.html', listing=listing, is_seller=is_seller, listing_type=listing_type)

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')





#OTHER ROUTES




@app.route('/send_connection_email', methods=['POST'])
@login_required
def send_connection_email():
  listing_id = request.form.get('listing_id')
  listing_type = request.form.get('listing_type')

  sender_email = session['user_email']

  # Check if sender's UNI is banned
  sender_uni = extract_uni(sender_email)
  if sender_uni and is_uni_banned(sender_uni):
    flash("Error: Your account has been banned.", "error")
    return redirect(url_for('index'))
  
  sender = User.query.filter_by(email=sender_email).first()
  sender_name = sender.name
  sender_phone = sender.phone or ""
  
  # Get the listing and owner's email
  if listing_type == 'seller':
    receiver = SellerListing.query.get(listing_id)
  else:
    receiver = BuyerListing.query.get(listing_id) 
  receiver_email = receiver.user.email
  
  # Extract UNIs for block checking
  sender_uni = extract_uni(sender_email)
  receiver_uni = extract_uni(receiver_email)
  
  # Check if sender has blocked receiver or receiver has blocked sender
  if sender_uni and receiver_uni:
    sender_blocked_receiver = BlockedUser.query.filter_by(
      blocker_uni=sender_uni, 
      blocked_uni=receiver_uni
    ).first()
    
    receiver_blocked_sender = BlockedUser.query.filter_by(
      blocker_uni=receiver_uni, 
      blocked_uni=sender_uni
    ).first()
    
    # If either user has blocked the other, just redirect back to index page silently
    if sender_blocked_receiver or receiver_blocked_sender:
      return redirect(url_for('index'))
  
  # Create a record of this contact
  contact_record = ContactRecord(
    listing_id=int(listing_id),  # Convert listing_id to integer
    listing_type=listing_type,
    user_email=sender_email
  )
  db.session.add(contact_record)
  
  # If receiver is buyer
  if isinstance(receiver, BuyerListing):
    buyer_name = receiver.user.name
    buyer_email = receiver.user.email
    buyer_phone = receiver.user.phone
    # And sender is seller
    seller_name = sender_name
    seller_email = sender_email
    
    # Get sender's phone if available
    seller_phone = sender_phone

    # Format times to 12-hour format
    start_time_formatted = format_time_to_12hour(receiver.start_time)
    end_time_formatted = format_time_to_12hour(receiver.end_time)
    # Format date without year
    date_formatted = format_date_without_year(receiver.date)
    # Format dining halls and payment methods
    dining_halls_formatted = format_dining_halls(receiver.dining_hall)
    payment_methods_formatted = format_payment_methods(receiver.payment_methods)

    # Compose email
    subject = "[Swipe Market] Potential Sale"
    price_str = f"{receiver.price:.2f}" if receiver.price is not None else "0.00"
    body = (
      f"<p>Hi {buyer_name},</p>"
      f"<p>{seller_name} is interested in selling a swipe to you! "
      f"You can reach them at {seller_email}"
    )
    
    # Add phone numbers if available
    if seller_phone and seller_phone.strip() != "":
      body += f" or via phone at {seller_phone}"
    
    if buyer_phone and buyer_phone.strip() != "":
      body += f". {seller_name}, you can reach {buyer_name} at {buyer_email} or via phone at {buyer_phone}."
    else:
      body += f". {seller_name}, you can reach {buyer_name} at {buyer_email}."
    
    body += (
      f"</p>"
      f"<p>It's up to you guys to coordinate a meeting and exchange payment details - as a reminder, {buyer_name} wants to be swiped into {dining_halls_formatted} "
      f"on {date_formatted} between {start_time_formatted} and {end_time_formatted} for ${price_str}. "
      f"They can pay via {payment_methods_formatted}.</p>"
      f"<p>{buyer_name}, remember to delete your listing on the website once you've agreed to the sale.</p>"
      f"<p>Best,<br>Swipe Market</p>"
    )
    
  # If receiver is seller
  else:
    seller_name = receiver.user.name
    seller_email = receiver.user.email
    seller_phone = receiver.user.phone
    # And sender is buyer
    buyer_name = sender_name
    buyer_email = sender_email
    
    # Get sender's phone if available
    buyer_phone = sender_phone

    # Format times to 12-hour format
    start_time_formatted = format_time_to_12hour(receiver.start_time)
    end_time_formatted = format_time_to_12hour(receiver.end_time)
    # Format date without year
    date_formatted = format_date_without_year(receiver.date)
    # Format dining halls and payment methods
    dining_halls_formatted = format_dining_halls(receiver.dining_hall)
    payment_methods_formatted = format_payment_methods(receiver.payment_methods)

    # Compose email
    subject = "[Swipe Market] Potential Sale"
    price_str = f"{receiver.price:.2f}" if receiver.price is not None else "0.00"
    body = (
      f"<p>Hi {seller_name},</p>"
      f"<p>{buyer_name} is interested in buying a swipe from you! "
      f"You can reach them at {buyer_email}"
    )
    
    # Add phone numbers if available
    if buyer_phone and buyer_phone.strip() != "":
      body += f" or via phone at {buyer_phone}"
    
    if seller_phone and seller_phone.strip() != "":
      body += f". {buyer_name}, you can reach {seller_name} at {seller_email} or via phone at {seller_phone}."
    else:
      body += f". {buyer_name}, you can reach {seller_name} at {seller_email}."
    
    body += (
      f"</p>"
      f"<p>It's up to you guys to coordinate a meeting and exchange payment details - as a reminder, the listing is for {dining_halls_formatted} on "
      f"{date_formatted} between {start_time_formatted} and {end_time_formatted} and costs "
      f"${price_str}. "
      f"{seller_name} accepts {payment_methods_formatted}.</p>"
      f"<p>{seller_name}, if this is the only swipe you want to sell from this listing, "
      f"remember to delete your listing on the website once you've agreed to the sale.</p>"
      f"<p>Best,<br>Swipe Market</p>"
    )

  # Send email
  recipients = [seller_email, buyer_email]
  msg = Message(subject, sender=app.config['MAIL_USERNAME'], recipients=recipients)
  msg.html = body

  try:
    mail.state.smtp.debuglevel = 1
    #attempt send
    mail.send(msg)
    db.session.commit()  # Commit the contact record after successfully sending the email
    print(f"Email successfully sent to {recipients}")
    return redirect(url_for('index', show_popup='true', contacted_id=listing_id))
  except SMTPException as e: 
    # these attributes are set when smtplib raises SMTPException
    code  = getattr(e, 'smtp_code', None)
    error = getattr(e, 'smtp_error', e)
    print(f"SMTPException sending mail → code={code}, error={error!r}")
    db.session.rollback()
    return redirect(url_for('index', error='true'))
  except Exception as e:
    db.session.rollback()  # Rollback on error
    return redirect(url_for('index', error='true'))



@app.route('/delete_listing/<int:listing_id>', methods=['POST'])
@login_required
def delete_listing(listing_id):
    user_email = session['user_email']
    listing_type = request.form.get('listing_type')
    if not user_email:
        return "Unauthorized - Please log in", 401
    
    # Check if UNI is banned
    user_uni = extract_uni(user_email)
    if user_uni and is_uni_banned(user_uni):
        return "Unauthorized - Your account has been banned", 403
    
    if not listing_type or listing_type not in ['seller', 'buyer']:
        return f"Invalid listing type: {listing_type} - must be 'seller' or 'buyer'", 400

    listing = (SellerListing if listing_type == 'seller' else BuyerListing).query.get_or_404(listing_id)
    if listing.user.email.lower() != user_email.lower():
        return f"Unauthorized - You don't own this listing. User email: {user_email}, Listing owner email: {listing.user.email}", 403

    listing.is_active = False
    db.session.commit()
    return redirect(url_for('index'))


# Routes for user profile management
@app.route('/api/check_user', methods=['POST'])
@login_required
def check_user():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"exists": False, "error": "Email is required"}), 400
    
    user = User.query.filter_by(email=email).first()
    if user:
        return jsonify({
            "exists": True, 
            "name": user.name, 
            "email": user.email, 
            "phone": user.phone
        })
    else:
        return jsonify({"exists": False})

@app.route('/api/save_user', methods=['POST'])
@login_required
def save_user():
    user_email = session['user_email']
    name = request.json.get('name')
    email = request.json.get('email')
    phone = request.json.get('phone')

    if request.json.get('email') != user_email:
        return jsonify({"success": False, "error": "Email mismatch"}), 403
    
    if not email or not name:
        return jsonify({"success": False, "error": "Name and email are required"}), 400
    
    # Validate email domain
    if not validate_email_domain(email):
        return jsonify({"success": False, "error": "Only Columbia and Barnard email addresses are allowed"}), 400
    
    # Check if UNI is banned
    user_uni = extract_uni(email)
    if user_uni and is_uni_banned(user_uni):
        return jsonify({"success": False, "error": "Your account has been banned"}), 403
    
    # Check if user already exists
    user = User.query.filter_by(email=email).first()
    if user:
        # Update existing user
        user.name = name
        user.phone = phone
    else:
        # Create new user
        user = User(name=name, email=email, phone=phone)
        db.session.add(user)
    
    try:
        db.session.commit()
        return jsonify({
            "success": True, 
            "name": user.name, 
            "email": user.email, 
            "phone": user.phone
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get_contacted_listings', methods=['POST'])
@login_required
def get_contacted_listings():
    email = session['user_email']
    
    if not email:
        return jsonify({"success": False, "error": "Email is required"}), 400
    
    # Query the database for all contacts by this user
    contacts = ContactRecord.query.filter_by(user_email=email).all()
    
    # Format the result as a list of listing IDs with types
    contacted_listings = [{
        "id": contact.listing_id, 
        "type": contact.listing_type
    } for contact in contacts]
    
    return jsonify({
        "success": True,
        "contacted_listings": contacted_listings
    })

# Routes for blocked users
@app.route('/api/block_user', methods=['POST'])
@login_required
def block_user():
    # Get the user's email from the Authorization header
    blocker_email = session.get('user_email')
    if not blocker_email:
        return jsonify({"success": False, "error": "Not authenticated"}), 401
    
    # Check if blocker's UNI is banned
    blocker_uni = extract_uni(blocker_email)
    if blocker_uni and is_uni_banned(blocker_uni):
        return jsonify({"success": False, "error": "Your account has been banned"}), 403
    
    # Get data from request
    data = request.get_json()
    blocked_uni = data.get('blocked_uni', '').strip().lower()
    
    if not blocked_uni:
        return jsonify({"success": False, "error": "UNI to block is required"}), 400
    
    # Extract blocker's UNI
    blocker_uni = extract_uni(blocker_email)
    if not blocker_uni:
        return jsonify({"success": False, "error": "Could not extract your UNI"}), 400
    
    # Don't allow self-blocking
    if blocker_uni == blocked_uni:
        return jsonify({"success": False, "error": "You cannot block yourself"}), 400
    
    # Check if block already exists
    existing_block = BlockedUser.query.filter_by(
        blocker_uni=blocker_uni,
        blocked_uni=blocked_uni
    ).first()
    
    if existing_block:
        return jsonify({"success": True, "message": "User was already blocked"})
    
    # Create new block
    new_block = BlockedUser(
        blocker_uni=blocker_uni,
        blocked_uni=blocked_uni
    )
    
    try:
        db.session.add(new_block)
        db.session.commit()
        return jsonify({"success": True, "message": "User blocked successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/unblock_user', methods=['POST'])
@login_required
def unblock_user():
    # Get the user's email from the session
    blocker_email = session.get('user_email')
    if not blocker_email:
        return jsonify({"success": False, "error": "Not authenticated"}), 401
    
    # Check if blocker's UNI is banned
    blocker_uni = extract_uni(blocker_email)
    if blocker_uni and is_uni_banned(blocker_uni):
        return jsonify({"success": False, "error": "Your account has been banned"}), 403
    
    # Get data from request
    data = request.get_json()
    blocked_uni = data.get('blocked_uni', '').strip().lower()
    
    if not blocked_uni:
        return jsonify({"success": False, "error": "UNI to unblock is required"}), 400
    
    # Extract blocker's UNI
    blocker_uni = extract_uni(blocker_email)
    if not blocker_uni:
        return jsonify({"success": False, "error": "Could not extract your UNI"}), 400
    
    # Find and remove the block
    block = BlockedUser.query.filter_by(
        blocker_uni=blocker_uni,
        blocked_uni=blocked_uni
    ).first()
    
    if not block:
        return jsonify({"success": True, "message": "User was not blocked"})
    
    try:
        db.session.delete(block)
        db.session.commit()
        return jsonify({"success": True, "message": "User unblocked successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get_blocked_users', methods=['GET'])
@login_required
def get_blocked_users():
    # Get the user's email from the session
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"success": False, "error": "Not authenticated"}), 401
    
    # Extract user's UNI
    user_uni = extract_uni(user_email)
    if not user_uni:
        return jsonify({"success": False, "error": "Could not extract your UNI"}), 400
    
    # Get all blocked users
    blocked_users = BlockedUser.query.filter_by(blocker_uni=user_uni).all()
    
    # Format the result
    blocked_unis = [block.blocked_uni for block in blocked_users]
    
    return jsonify({
        "success": True,
        "blocked_users": blocked_unis
    })

"""@app.after_request
def set_security_headers(response):
    csp = (
        "default-src 'self'; "
        "script-src 'self' https://accounts.google.com https://www.googletagmanager.com; "
        "style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self';"
    )
    response.headers['Content-Security-Policy'] = csp
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=()'
    return response"""

@app.route('/api/check_banned_uni', methods=['POST'])
def check_banned_uni():
    try:
        data = request.get_json()
        uni = data.get('uni', '').lower()
        
        if not uni:
            return jsonify({"banned": False})
        
        # Get banned UNIs from environment variable
        banned_unis_str = os.environ.get('BANNED_UNIS', '')
        banned_unis = [u.strip().lower() for u in banned_unis_str.split(',')] if banned_unis_str else []
        
        is_banned = uni in banned_unis
        
        return jsonify({"banned": is_banned})
    except Exception as e:
        return jsonify({"banned": False, "error": str(e)})

@app.route('/api/get_profile', methods=['GET'])
@login_required
def get_profile():
    # Get the user's email from the session
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"success": False, "error": "Not authenticated"}), 401
    
    # Get user from database
    user = User.query.filter_by(email=user_email).first()
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404
    
    return jsonify({
        "success": True,
        "name": user.name,
        "email": user.email,
        "phone": user.phone
    })

@app.route('/api/update_profile', methods=['POST'])
@login_required
def update_profile():
    # Get the user's email from the session
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"success": False, "error": "Not authenticated"}), 401
    
    # Check if UNI is banned
    user_uni = extract_uni(user_email)
    if user_uni and is_uni_banned(user_uni):
        return jsonify({"success": False, "error": "Your account has been banned"}), 403
    
    # Get data from request
    data = request.get_json()
    name = data.get('name')
    phone = data.get('phone')
    
    if not name:
        return jsonify({"success": False, "error": "Name is required"}), 400
    
    # Get or create user
    user = User.query.filter_by(email=user_email).first()
    if not user:
        user = User(email=user_email)
        db.session.add(user)
    
    # Update user data
    user.name = name
    user.phone = phone
    
    try:
        db.session.commit()
        return jsonify({
            "success": True,
            "name": user.name,
            "email": user.email,
            "phone": user.phone
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/post_listings')
def post_listings():
    return render_template('post-listings.html')

@app.route('/submit_listing', methods=['POST'])
@login_required
def submit_listing():
    user_email = session['user_email']
        
    # Validate email domain
    if not validate_email_domain(user_email):
        flash("Error: Only Columbia and Barnard email addresses are allowed.", "error")
        return redirect(url_for('post_listings'))
    # Check if UNI is banned
    user_uni = extract_uni(user_email)
    if user_uni and is_uni_banned(user_uni):
        flash("Error: Your account has been banned.", "error")
        return redirect(url_for('post_listings'))
        
    # Get values from the form
    dining_halls = request.form.getlist('dining_hall[]')
    if not dining_halls:
        flash("Error: Please select at least one dining hall.", "error")
        return redirect(url_for('post_listings'))
        
    dining_halls_str = ", ".join(dining_halls)
    date = request.form.get('date')
    start_time = request.form.get('start_time')
    end_time = request.form.get('end_time')
    price = request.form.get('price')
    payment_methods_list = request.form.getlist('payment_methods[]')
    
    if not payment_methods_list:
        flash("Error: Please select at least one payment method.", "error")
        return redirect(url_for('post_listings'))
        
    payment_methods = ', '.join(payment_methods_list)
    
    poster_email = request.form.get('poster_email')
    listing_type = request.form.get('listing_type')

    # Validate that if date is today, end time is in the future
    now = datetime.now(ny_tz)
    today_date = now.strftime("%Y-%m-%d")
    
    if date == today_date:
        try:
            end_hour, end_minute = map(int, end_time.split(':'))
            end_datetime = now.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
            
            if end_datetime < now:
                flash("Error: For today's listings, end time must be in the future.", "error")
                return redirect(url_for('post_listings'))
        except Exception as e:
            flash("Error: Invalid time format.", "error")
            return redirect(url_for('post_listings'))

    try:
        price_value = float(price)
        if price_value < 0:
            flash("Error: Price cannot be negative.", "error")
            return redirect(url_for('post_listings'))
    except (ValueError, TypeError):
        flash("Error: Please enter a valid price (number).", "error")
        return redirect(url_for('post_listings'))

    user = User.query.filter_by(email=poster_email).first()

    # Create new listing based on type
    if listing_type == 'seller':
        new_listing = SellerListing(
            dining_hall=dining_halls_str,
            date=date,
            start_time=start_time,
            end_time=end_time,
            price=price_value,
            payment_methods=payment_methods,
            user_id=user.id
        )
    else:  # listing_type == 'buyer'
        new_listing = BuyerListing(
            dining_hall=dining_halls_str,
            date=date,
            start_time=start_time,
            end_time=end_time,
            price=price_value,
            payment_methods=payment_methods,
            user_id=user.id
        )

    # Add new listing to database
    db.session.add(new_listing)
    db.session.commit()

    # Redirect to Swipe Market page
    return redirect(url_for('index'))

def format_dining_halls(dining_halls_str):
    if not dining_halls_str:
        return "any dining hall"
    
    dining_halls = [dh.strip() for dh in dining_halls_str.split(',')]
    
    if "Any" in dining_halls:
        return "any dining hall"
    
    if len(dining_halls) == 1:
        return dining_halls[0]
    
    if len(dining_halls) == 2:
        return f"{dining_halls[0]} or {dining_halls[1]}"
    
    return f"{', '.join(dining_halls[:-1])}, or {dining_halls[-1]}"

def format_payment_methods(payment_methods_str):
    if not payment_methods_str:
        return "any payment method"
    
    payment_methods = [pm.strip() for pm in payment_methods_str.split(',')]
    
    if "Any" in payment_methods:
        return "any payment method"
    
    if len(payment_methods) == 1:
        return payment_methods[0]
    
    if len(payment_methods) == 2:
        return f"{payment_methods[0]} or {payment_methods[1]}"
    
    return f"{', '.join(payment_methods[:-1])}, or {payment_methods[-1]}"

if __name__ == '__main__':
   app.run(host='0.0.0.0',port=5000)