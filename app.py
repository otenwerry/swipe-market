from flask import Flask, render_template, request, redirect, url_for, session
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
# CAROLINE BRANCH COMMENT

# CAROLINE BRANCH COMMENT 2
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

    def __repr__(self):
        return f'<BuyerListing {self.id} - {self.buyer_name}>'

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
  #print("poster name: " + buyer_name)
  #print("poster email: " + buyer_email)
  buyer_phone = request.form.get('phone_number')

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

#create all tables in the database
with app.app_context():
    db.create_all()

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

#create all tables in the database
with app.app_context():
    db.create_all()


@app.route('/contact_form', methods=['POST'])
def contact_form():
  email = request.form.get('email')
  flash('Success! Your email has been submitted', 'success')
  return redirect(url_for('/'))

@app.route('/send_connection_email', methods=['POST'])
def send_connection_email():
  sender_name = request.form.get('sender_name')
  sender_email = request.form.get('sender_email')
  listing_id = request.form.get('listing_id')

  # Try to find the listing in both buyer and seller tables
  receiver_listing = SellerListing.query.get(listing_id)
  if not receiver_listing:
    receiver_listing = BuyerListing.query.get(listing_id)
    if not receiver_listing:
      flash("Error: Listing not found.", "error")
      return redirect(url_for('index'))

  # Get the receiver's information based on the listing type
  if isinstance(receiver_listing, BuyerListing):
    receiver_name = receiver_listing.buyer_name
    receiver_email = receiver_listing.buyer_email
  else:
    receiver_name = receiver_listing.seller_name
    receiver_email = receiver_listing.seller_email

  subject = "[Swipe Market] Potential Sale"
  body = (
    f"Hello {receiver_name},\n\n"
    f"{sender_name} is interested in buying a swipe from you. You can reach them at {sender_email}.\n"
    f"{sender_name}, you can reach {receiver_name} at {receiver_email}.\n"
    "As a reminder, the listing is for DINING HALL from START TIME to END TIME and costs PRICE."
    f"{receiver_name} takes PAYMENT MEHTODS.\n\n"
    "Best regards,\n"
    "Swipe Market Team"
  )
  recipients = [sender_email, receiver_email]
  msg = Message(subject, sender=app.config['MAIL_USERNAME'], recipients=recipients)
  msg.body = body
  
  try:
    mail.send(msg)
    return redirect(url_for('index', show_popup='true'))
  except Exception as e:
    print("Email sending error:", e)
    return redirect(url_for('index', error='true'))
  
  return redirect(url_for('index'))

#regular route for the Swipe Market page
@app.route('/')
def index():
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
    seller_listings = SellerListing.query.all()
    buyer_listings = BuyerListing.query.all()
    
    # Sort listings by multiple criteria
    seller_listings = sorted(seller_listings, key=get_sort_key)
    buyer_listings = sorted(buyer_listings, key=get_sort_key)
    
    return render_template('index.html', seller_listings=seller_listings, buyer_listings=buyer_listings)

#regular route for the listings page
@app.route('/listings')
def listings():
  return render_template('listings.html')

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

@app.route('/delete_listing/<int:listing_id>', methods=['POST'])
def delete_listing(listing_id):
    listing = SellerListing.query.get(listing_id) or BuyerListing.query.get(listing_id)
    if listing:
        db.session.delete(listing)
        db.session.commit()
    return redirect(url_for('index'))

"""
@app.route('/edit_listing/<int:listing_id>')
def edit_listing(listing_id):
    listing = SellerListing.query.get(listing_id) or BuyerListing.query.get(listing_id)
    if listing:
        return render_template('listings.html', listing=listing)  # Reuse your existing form
    return redirect(url_for('index'))
"""

if __name__ == '__main__':
   with app.app_context():
     db.create_all()
   app.run(host='0.0.0.0',port=5000, debug=True)