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
from flask_migrate import Migrate

app = Flask(__name__) #sets up a flask application
app.secret_key = os.environ.get('SECRET_KEY','fallback-secret-key') 
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') # for PostgreSQL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
migrate = Migrate(app, db)
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT'))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_DEFAULT_SENDER'] = 'liondinecu@gmail.com'
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
mail = Mail(app)

ny_tz = pytz.timezone('America/New_York')
# test comment

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

# User model to store user information
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False, unique=True)
    phone = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<User {self.id} - {self.name}>'

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
  buyer_phone = request.form.get('phone_number')

  # If phone number is not provided in the form, try to get it from the User model
  if not buyer_phone or buyer_phone.strip() == "":
    user = User.query.filter_by(email=buyer_email).first()
    if user and user.phone:
      buyer_phone = user.phone

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
  seller_phone = request.form.get('phone_number')
  #print("poster name: " + seller_name)
  #print("poster email: " + seller_email)

  # If phone number is not provided in the form, try to get it from the User model
  if not seller_phone or seller_phone.strip() == "":
    user = User.query.filter_by(email=seller_email).first()
    if user and user.phone:
      seller_phone = user.phone

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
  
  if listing_type == 'seller':
    receiver_listing = SellerListing.query.get(listing_id)
    if not receiver_listing:
      flash("Error: Seller listing not found.", "error")
      return redirect(url_for('index'))
  else:
    receiver_listing = BuyerListing.query.get(listing_id)
    if not receiver_listing:
      flash("Error: Buyer listing not found.", "error")
      return redirect(url_for('index'))
  
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
    if sender_user and sender_user.phone:
      seller_phone = sender_user.phone

    # Compose email
    subject = "[Swipe Market] Potential Sale"
    body = (
      f"Hello {buyer_name},\n\n"
      f"{seller_name} is interested in selling a swipe to you. "
      f"You can reach them at {seller_email}"
    )
    
    # Add phone numbers if available
    if seller_phone:
      body += f" or via phone at {seller_phone}"
    
    body += ".\n\n"
    
    if buyer_phone:
      body += f"{seller_name}, you can reach {buyer_name} at {buyer_email} or via phone at {buyer_phone}.\n\n"
    else:
      body += f"{seller_name}, you can reach {buyer_name} at {buyer_email}.\n\n"
    
    body += (
      f"As a reminder, {buyer_name} wants to be swiped into {buyer_listing.dining_hall} "
      f"between {buyer_listing.start_time} and {buyer_listing.end_time} for ${buyer_listing.price}. "
      f"They can pay via {buyer_listing.payment_methods}.\n\n"
      f"{buyer_name}, remember to delete your listing once you've agreed to the sale.\n\n"
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
    if sender_user and sender_user.phone:
      buyer_phone = sender_user.phone

    # Compose email
    subject = "[Swipe Market] Potential Sale"
    body = (
      f"Hello {seller_name},\n\n"
      f"{buyer_name} is interested in buying a swipe from you. "
      f"You can reach them at {buyer_email}"
    )
    
    # Add phone numbers if available
    if buyer_phone:
      body += f" or via phone at {buyer_phone}"
    
    body += ".\n\n"
    
    if seller_phone:
      body += f"{buyer_name}, you can reach {seller_name} at {seller_email} or via phone at {seller_phone}.\n\n"
    else:
      body += f"{buyer_name}, you can reach {seller_name} at {seller_email}.\n\n"
    
    body += (
      f"As a reminder, the listing is for {seller_listing.dining_hall} from "
      f"{seller_listing.start_time} to {seller_listing.end_time} and costs "
      f"${seller_listing.price}. "
      f"{seller_name} accepts {seller_listing.payment_methods}.\n\n"
      f"{seller_name}, if this is the only swipe you want to sell today, "
      "remember to delete your listing once you've agreed to the sale.\n\n"
      "Best regards,\n"
      "Swipe Market Team"
    )

  # Send email
  recipients = [seller_email, buyer_email]
  msg = Message(subject, sender=app.config['MAIL_USERNAME'], recipients=recipients)
  msg.body = body

  try:
    mail.send(msg)
    return redirect(url_for('index', show_popup='true'))
  except Exception as e:
    return redirect(url_for('index', error='true'))

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

    # Get all listings and sort them
    seller_listings = SellerListing.query.filter_by(is_active=True).all()
    buyer_listings = BuyerListing.query.filter_by(is_active=True).all()
    
    # Sort listings by multiple criteria
    seller_listings = sorted(seller_listings, key=get_sort_key)
    buyer_listings = sorted(buyer_listings, key=get_sort_key)
    
    return render_template('index.html', seller_listings=seller_listings, buyer_listings=buyer_listings)

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
    
    # Check if user already exists
    user = User.query.filter_by(email=email).first()
    if user:
        # Update existing user
        user.name = name
        if phone:
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

@app.route('/profile')
def profile():
    return render_template('profile.html')

if __name__ == '__main__':
   with app.app_context():
     db.create_all()
   app.run(host='0.0.0.0',port=5000, debug=True)