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
from flask_mail import Mail, Message

app = Flask(__name__) #sets up a flask application
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
mail = Mail(app)

ny_tz = pytz.timezone('America/New_York')


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
    seller_name = db.Column(db.String(100), nullable=False)
    seller_email = db.Column(db.String(100), nullable=False)
    seller_phone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self):
        return f'<SellerListing {self.id} - {self.seller_name}>'

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
    buyer_name = db.Column(db.String(100), nullable=False)
    buyer_email = db.Column(db.String(100), nullable=False)
    buyer_phone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def __repr__(self):
        return f'<BuyerListing {self.id} - {self.buyer_name}>'

# model to store user information
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    phone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<User {self.id} - {self.name}>'

# model to store contact records
class ContactRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, nullable=False)
    listing_type = db.Column(db.String(10), nullable=False)  # "seller" or "buyer"
    user_email = db.Column(db.String(100), nullable=False)
    contact_time = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ContactRecord {self.id} - {self.user_email} contacted {self.listing_type} {self.listing_id}>'

# model to store blocked users
class BlockedUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    blocker_uni = db.Column(db.String(20), nullable=False)
    blocked_uni = db.Column(db.String(20), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
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
    print(f"Current time (NY timezone): {now}")
    
    # Update SellerListings
    active_sellers = SellerListing.query.filter_by(is_active=True).all()
    for listing in active_sellers:
        try:
            expiration_str = f"{listing.date} {listing.end_time}"
            print(f"Processing seller listing {listing.id}, expiration string: {expiration_str}")
            expiration = datetime.strptime(expiration_str, "%Y-%m-%d %H:%M")
            expiration = ny_tz.localize(expiration)
            print(f"Seller listing {listing.id}: expiration={expiration}, now={now}")
            
            if now > expiration:
                print(f"Marking seller listing {listing.id} as inactive")
                listing.is_active = False
            else:
                print(f"Seller listing {listing.id} is still active, expires in {expiration - now}")
        except Exception as e:
            print(f"Error updating SellerListing {listing.id}: {e}")
            # Continue with next listing
    
    # Update BuyerListings
    active_buyers = BuyerListing.query.filter_by(is_active=True).all()
    for listing in active_buyers:
        try:
            expiration_str = f"{listing.date} {listing.end_time}"
            print(f"Processing buyer listing {listing.id}, expiration string: {expiration_str}")
            expiration = datetime.strptime(expiration_str, "%Y-%m-%d %H:%M")
            expiration = ny_tz.localize(expiration)
            print(f"Buyer listing {listing.id}: expiration={expiration}, now={now}")
            
            if now > expiration:
                print(f"Marking buyer listing {listing.id} as inactive")
                listing.is_active = False
            else:
                print(f"Buyer listing {listing.id} is still active, expires in {expiration - now}")
        except Exception as e:
            print(f"Error updating BuyerListing {listing.id}: {e}")
            # Continue with next listing

    #commit changes to database
    db.session.commit()


# PAGE ROUTES

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
    
    # Try to get user email from multiple sources
    current_user_email = request.args.get('email')
    if not current_user_email:
        current_user_email = request.cookies.get('userEmail')
    if not current_user_email:
        current_user_email = session.get('user_email')
    
    print(f"Current user email: {current_user_email}")
    
    if current_user_email:
        current_user_uni = extract_uni(current_user_email)
        print(f"Current user UNI: {current_user_uni}")
        
        if current_user_uni:
            # Get lists of UNIs that the current user has blocked and that have blocked the current user
            blocked_by_user = [block.blocked_uni for block in BlockedUser.query.filter_by(blocker_uni=current_user_uni).all()]
            blocked_user = [block.blocker_uni for block in BlockedUser.query.filter_by(blocked_uni=current_user_uni).all()]
            
            # Combine both lists to get all UNIs that should be filtered out
            all_blocked_unis = set(blocked_by_user + blocked_user)
            print(f"All blocked UNIs: {all_blocked_unis}")
            
            # Filter seller listings
            filtered_seller_listings = []
            for listing in seller_listings:
                seller_uni = extract_uni(listing.seller_email)
                if seller_uni not in all_blocked_unis:
                    filtered_seller_listings.append(listing)
                else:
                    print(f"Filtering out seller listing {listing.id} from {seller_uni}")
            
            # Filter buyer listings
            filtered_buyer_listings = []
            for listing in buyer_listings:
                buyer_uni = extract_uni(listing.buyer_email)
                if buyer_uni not in all_blocked_unis:
                    filtered_buyer_listings.append(listing)
                else:
                    print(f"Filtering out buyer listing {listing.id} from {buyer_uni}")
            
            seller_listings = filtered_seller_listings
            buyer_listings = filtered_buyer_listings
    
    # Sort listings by multiple criteria
    seller_listings = sorted(seller_listings, key=get_sort_key)
    buyer_listings = sorted(buyer_listings, key=get_sort_key)
    
    # Create a response
    response = make_response(render_template('index.html', seller_listings=seller_listings, buyer_listings=buyer_listings))
    
    # If we have a user email, store it in the session and as a cookie
    if current_user_email:
        session['user_email'] = current_user_email
        response.set_cookie('userEmail', current_user_email, max_age=86400)
    
    return response

#regular route for the listings page
@app.route('/listings/<int:listing_id>', methods=['GET'])
@app.route('/listings', methods=['GET'])
def listings(listing_id=None):
    if listing_id:
        # Try to find the listing in both seller and buyer tables
        listing = SellerListing.query.get(listing_id)
        is_seller = True
        if not listing:
            listing = BuyerListing.query.get(listing_id)
            is_seller = False
            if not listing:
                return redirect(url_for('index'))
        return render_template('listings.html', listing=listing, is_seller=is_seller)
    return render_template('listings.html', listing=None)

"""
@app.route('/clear_database')
def clear_database():
    try:
        # delete all records from both tables
        SellerListing.query.delete()
        BuyerListing.query.delete()
        # commit changes
        db.session.commit()
        return "Database cleared successfully"
    except Exception as e:
        db.session.rollback()
        return f"Error clearing database: {str(e)}"
"""

@app.route('/edit_listing/<int:listing_id>', methods=['GET', 'POST'])
def edit_listing(listing_id):
    print("Method: ", request.method)
    user_email = request.args.get('user_email') if request.method == 'GET' else request.form.get('poster_email')
    #user_email = request.form.get('poster_email')
    print("User email: ", user_email)
    if not user_email:
        return redirect(url_for('index'))
    
    listing = SellerListing.query.get(listing_id)
    if not listing:
        listing = BuyerListing.query.get_or_404(listing_id)

    is_seller = isinstance(listing, SellerListing)

    # Check if the user owns the listing
    if (is_seller and listing.seller_email != user_email) or \
       (not is_seller and listing.buyer_email != user_email):
        return redirect(url_for('index'))

    if request.method == 'POST' and 'dining_hall[]' in request.form:
        print("Form data received: ", request.form)
        # Update the listing with new values
        listing.dining_hall = ", ".join(request.form.getlist('dining_hall[]'))
        listing.date = request.form.get('date')
        listing.start_time = request.form.get('start_time')
        listing.end_time = request.form.get('end_time')
        try:
            listing.price = float(request.form.get('price'))
        except (ValueError, TypeError):
            listing.price = -1.0
        listing.payment_methods = ", ".join(request.form.getlist('payment_methods[]'))
        
        try:
            print("Before commit - start_time:", listing.start_time)  # Debug log
            db.session.commit()
            print("After commit - start_time:", listing.start_time)  # Debug log
            return redirect(url_for('index'))
        except Exception as e:
            print("Error updating:", str(e))
            db.session.rollback()
            return "Error updating listing", 500

    # Show the edit form for both GET requests and initial POST verification
    return render_template('edit_listing.html', listing=listing, is_seller=is_seller)

@app.route('/profile')
def profile():
    # Get banned words from environment variable
    banned_words_str = os.environ.get('BANNED_WORDS', '')
    banned_words = [word.strip() for word in banned_words_str.split(',')] if banned_words_str else []
    return render_template('profile.html', banned_words=banned_words)





#OTHER ROUTES



#route for taking buyer listings from the form
#and putting them into the database, then send
#the user back to the Swipe Market page
@app.route('/submit_buyer', methods=['POST'])
def submit_buyer():
  #get values from the form
  dining_halls = request.form.getlist('dining_hall[]')
  dining_halls_str = ", ".join(dining_halls)
  date = request.form.get('date')
  start_time = request.form.get('start_time')
  end_time = request.form.get('end_time')
  price = request.form.get('price')
  payment_methods_list = request.form.getlist('payment_methods[]')
  payment_methods=', '.join(payment_methods_list)
  
  buyer_name = request.form.get('poster_name')
  buyer_email = request.form.get('poster_email')
  print("poster name: " + buyer_name)
  print("poster email: " + buyer_email)
  
  # Always retrieve phone number from User model since form field has been removed
  buyer_phone = ""
  user = User.query.filter_by(email=buyer_email).first()
  if user and user.phone and user.phone.strip() != "":
    buyer_phone = user.phone

  # Validate that if date is today, start time is in the future
  now = datetime.now(ny_tz)
  today_date = now.strftime("%Y-%m-%d")
  
  if date == today_date:
      # Convert form start_time to datetime object for comparison
      try:
          start_hour, start_minute = map(int, start_time.split(':'))
          start_datetime = now.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
          
          if start_datetime < now:
              flash("Error: For today's listings, start time must be in the future.", "error")
              return redirect(url_for('index'))
      except Exception as e:
          print(f"Time validation error: {e}")
          flash("Error: Invalid time format.", "error")
          return redirect(url_for('index'))

  try:
    price_value = float(price)
  except (ValueError, TypeError):
    price_value = -1.0 

  #create new BuyerListing instance
  new_listing = BuyerListing(
    dining_hall=dining_halls_str,
    date=date,
    start_time=start_time,
    end_time=end_time,
    price=price_value,
    payment_methods=payment_methods,
    buyer_name=buyer_name,
    buyer_email=buyer_email,
    buyer_phone=buyer_phone
  )

  #add new listing to database
  db.session.add(new_listing)
  db.session.commit()

  #redirect to Swipe Market page
  return redirect(url_for('index'))

#route for taking seller listings from the form
#and putting them into the database, then send
#the user back to the Swipe Market page
@app.route('/submit_seller', methods=['POST'])
def submit_seller():
  #get values from the form
  dining_halls = request.form.getlist('dining_hall[]')
  dining_halls_str = ", ".join(dining_halls)
  date = request.form.get('date')
  start_time = request.form.get('start_time')
  end_time = request.form.get('end_time')
  price = request.form.get('price')
  payment_methods_list = request.form.getlist('payment_methods[]')
  payment_methods=', '.join(payment_methods_list)
  
  seller_name = request.form.get('poster_name')
  seller_email = request.form.get('poster_email')
  
  # Always retrieve phone number from User model since form field has been removed
  seller_phone = ""
  user = User.query.filter_by(email=seller_email).first()
  if user and user.phone and user.phone.strip() != "":
    seller_phone = user.phone

  # Validate that if date is today, start time is in the future
  now = datetime.now(ny_tz)
  today_date = now.strftime("%Y-%m-%d")
  
  if date == today_date:
      # Convert form start_time to datetime object for comparison
      try:
          start_hour, start_minute = map(int, start_time.split(':'))
          start_datetime = now.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
          
          if start_datetime < now:
              flash("Error: For today's listings, start time must be in the future.", "error")
              return redirect(url_for('index'))
      except Exception as e:
          print(f"Time validation error: {e}")
          flash("Error: Invalid time format.", "error")
          return redirect(url_for('index'))

  try:
    price_value = float(price)
  except (ValueError, TypeError):
    price_value = -1.0 

  #create new SellerListing instance
  new_listing = SellerListing(
    dining_hall=dining_halls_str,
    date=date,
    start_time=start_time,
    end_time=end_time,
    price=price_value,
    payment_methods=payment_methods,
    seller_name=seller_name,
    seller_email=seller_email,
    seller_phone=seller_phone
  )

  #add new listing to database
  db.session.add(new_listing)
  db.session.commit()

  #redirect to Swipe Market page
  return redirect(url_for('index'))

@app.route('/contact_form', methods=['POST'])
def contact_form():
  email = request.form.get('email')
  flash('Success! Your email has been submitted', 'success')
  return redirect(url_for('/'))

@app.route('/send_connection_email', methods=['POST'])
def send_connection_email():
  listing_id = request.form.get('listing_id')
  listing_type = request.form.get('listing_type')
  sender_email = request.form.get('sender_email')
  
  # Get the listing and owner's email
  if listing_type == 'seller':
    receiver_listing = SellerListing.query.get(listing_id)
    if not receiver_listing:
      flash("Error: Seller listing not found.", "error")
      return redirect(url_for('index'))
    receiver_email = receiver_listing.seller_email
  else:
    receiver_listing = BuyerListing.query.get(listing_id)
    if not receiver_listing:
      flash("Error: Buyer listing not found.", "error")
      return redirect(url_for('index'))
    receiver_email = receiver_listing.buyer_email
  
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
  if isinstance(receiver_listing, BuyerListing):
    buyer_listing = receiver_listing
    buyer_name = buyer_listing.buyer_name
    buyer_email = buyer_listing.buyer_email
    buyer_phone = buyer_listing.buyer_phone
    # And sender is seller
    seller_name = request.form.get('sender_name')
    seller_email = request.form.get('sender_email')
    
    # Get sender's phone if available
    seller_phone = ""
    sender_user = User.query.filter_by(email=seller_email).first()
    if sender_user and sender_user.phone and sender_user.phone.strip() != "":
      seller_phone = sender_user.phone

    # Format times to 12-hour format
    start_time_formatted = format_time_to_12hour(buyer_listing.start_time)
    end_time_formatted = format_time_to_12hour(buyer_listing.end_time)
    # Format date without year
    date_formatted = format_date_without_year(buyer_listing.date)

    # Compose email
    subject = "[Swipe Market] Potential Sale"
    price_str = f"{buyer_listing.price:.2f}" if buyer_listing.price is not None else "0.00"
    body = (
      f"Hello {buyer_name},\n\n"
      f"{seller_name} is interested in selling a swipe to you. "
      f"You can reach them at {seller_email}"
    )
    
    # Add phone numbers if available
    if seller_phone and seller_phone.strip() != "":
      body += f" or via phone at {seller_phone}"
    
    body += ".\n\n"
    
    if buyer_phone and buyer_phone.strip() != "":
      body += f"{seller_name}, you can reach {buyer_name} at {buyer_email} or via phone at {buyer_phone}.\n\n"
    else:
      body += f"{seller_name}, you can reach {buyer_name} at {buyer_email}.\n\n"
    
    body += (
      f"As a reminder, {buyer_name} wants to be swiped into {buyer_listing.dining_hall} "
      f"on {date_formatted} between {start_time_formatted} and {end_time_formatted} for ${price_str}. "
      f"They can pay via {buyer_listing.payment_methods}.\n\n"
      f"{buyer_name}, remember to delete your listing "
      f"<a href='https://swipemarketcu.com/?auto_delete={listing_id}'>here</a> once you've agreed to the sale.\n\n"
      "Best regards,\n"
      "Swipe Market Team"
    )
    
  # If receiver is seller
  else:
    seller_listing = receiver_listing
    seller_name = seller_listing.seller_name
    seller_email = seller_listing.seller_email
    seller_phone = seller_listing.seller_phone
    # And sender is buyer
    buyer_name = request.form.get('sender_name')
    buyer_email = request.form.get('sender_email')
    
    # Get sender's phone if available
    buyer_phone = ""
    sender_user = User.query.filter_by(email=buyer_email).first()
    if sender_user and sender_user.phone and sender_user.phone.strip() != "":
      buyer_phone = sender_user.phone

    # Format times to 12-hour format
    start_time_formatted = format_time_to_12hour(seller_listing.start_time)
    end_time_formatted = format_time_to_12hour(seller_listing.end_time)
    # Format date without year
    date_formatted = format_date_without_year(seller_listing.date)

    # Compose email
    subject = "[Swipe Market] Potential Sale"
    price_str = f"{seller_listing.price:.2f}" if seller_listing.price is not None else "0.00"
    body = (
      f"Hello {seller_name},\n\n"
      f"{buyer_name} is interested in buying a swipe from you. "
      f"You can reach them at {buyer_email}"
    )
    
    # Add phone numbers if available
    if buyer_phone and buyer_phone.strip() != "":
      body += f" or via phone at {buyer_phone}"
    
    body += ".\n\n"
    
    if seller_phone and seller_phone.strip() != "":
      body += f"{buyer_name}, you can reach {seller_name} at {seller_email} or via phone at {seller_phone}.\n\n"
    else:
      body += f"{buyer_name}, you can reach {seller_name} at {seller_email}.\n\n"
    
    body += (
      f"As a reminder, the listing is for {seller_listing.dining_hall} on "
      f"{date_formatted} between {start_time_formatted} and {end_time_formatted} and costs "
      f"${price_str}. "
      f"{seller_name} accepts {seller_listing.payment_methods}.\n\n"
      f"{seller_name}, if this is the only swipe you want to sell from this listing, "
      f"remember to delete your listing <a href='https://swipemarketcu.com/?auto_delete={listing_id}'>here</a> "
      f"once you've agreed to the sale.\n\n"
      "Best regards,\n"
      "Swipe Market Team"
    )

  # Send email
  recipients = [seller_email, buyer_email]
  msg = Message(subject, sender=app.config['MAIL_USERNAME'], recipients=recipients)
  msg.html = body

  try:
    mail.send(msg)
    db.session.commit()  # Commit the contact record after successfully sending the email
    return redirect(url_for('index', show_popup='true', contacted_id=listing_id))
  except Exception as e:
    db.session.rollback()  # Rollback on error
    return redirect(url_for('index', error='true'))



@app.route('/delete_listing/<int:listing_id>', methods=['POST'])
def delete_listing(listing_id):
    # Get the user's email from the request
    user_email = request.form.get('user_email')
    if not user_email:
        return "Unauthorized - Please log in", 401

    # Try to find the listing in both tables
    listing = SellerListing.query.get(listing_id)
    is_seller = True
    if not listing:
        listing = BuyerListing.query.get_or_404(listing_id)
        is_seller = False

    # Check if the user owns the listing
    if (is_seller and listing.seller_email != user_email) or \
       (not is_seller and listing.buyer_email != user_email):
        return "Unauthorized - You don't own this listing", 403

    #set is_active to false``
    listing.is_active = False
    db.session.commit()
    return redirect(url_for('index'))


# Routes for user profile management
@app.route('/api/check_user', methods=['POST'])
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
def save_user():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    
    if not email or not name:
        return jsonify({"success": False, "error": "Name and email are required"}), 400
    
    # Ensure we only store the first name
    if name and ' ' in name:
        name = name.split(' ')[0]
    
    # Check if user already exists
    user = User.query.filter_by(email=email).first()
    if user:
        # Update existing user
        user.name = name
        # Always update phone field, even if it's an empty string
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
def get_contacted_listings():
    data = request.get_json()
    email = data.get('email')
    
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

# Extract UNI from an email address
def extract_uni(email):
    if not email:
        return None
    
    # Columbia/Barnard emails are in format uni@columbia.edu or uni@barnard.edu
    if '@columbia.edu' in email or '@barnard.edu' in email:
        return email.split('@')[0].lower()
    
    return None

# Routes for blocked users
@app.route('/api/block_user', methods=['POST'])
def block_user():
    data = request.get_json()
    blocker_email = data.get('blocker_email')
    blocked_uni = data.get('blocked_uni', '').strip().lower()
    
    if not blocker_email:
        return jsonify({"success": False, "error": "Your email is required"}), 400
    
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
def unblock_user():
    data = request.get_json()
    blocker_email = data.get('blocker_email')
    blocked_uni = data.get('blocked_uni', '').strip().lower()
    
    if not blocker_email or not blocked_uni:
        return jsonify({"success": False, "error": "Both emails are required"}), 400
    
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

@app.route('/api/get_blocked_users', methods=['POST'])
def get_blocked_users():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({"success": False, "error": "Email is required"}), 400
    
    # Extract user's UNI
    user_uni = extract_uni(email)
    if not user_uni:
        return jsonify({"success": False, "error": "Could not extract your UNI"}), 400
    
    # Get all blocked users
    blocked_users = BlockedUser.query.filter_by(blocker_uni=user_uni).all()
    
    # Format the result
    blocked_unis = [block.blocked_uni for block in blocked_users]
    
    return jsonify({
        "success": True,
        "blocked_unis": blocked_unis
    })

@app.route('/api/check_banned_uni', methods=['POST'])
def check_banned_uni():
    data = request.get_json()
    uni = data.get('uni', '').lower()
    
    if not uni:
        return jsonify({"banned": False})
    
    # Get banned UNIs from environment variable
    banned_unis_str = os.environ.get('BANNED_UNIS', '')
    banned_unis = [u.strip().lower() for u in banned_unis_str.split(',')] if banned_unis_str else []
    
    return jsonify({"banned": uni in banned_unis})

if __name__ == '__main__':
   with app.app_context():
     db.create_all()
   app.run(host='0.0.0.0',port=5000, debug=True)