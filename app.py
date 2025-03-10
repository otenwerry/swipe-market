from flask import Flask, render_template, request, redirect, url_for, session
from datetime import datetime, time 
import time as time_module
import random
import os
import requests
import json
import boto3
from time_functions import john_jay_open, jjs_open, ferris_open, fac_house_open, mikes_open, dons_open, grace_dodge_open, fac_shack_open, hewitt_open, diana_open, hours_dict, breakfast_hours, lunch_hours, dinner_hours, latenight_hours, johnnys_open
import string
import pytz
from  flask_sqlalchemy import SQLAlchemy
from flask import make_response, g, render_template, flash
from flask_mail import Mail, Message

app = Flask(__name__) #sets up a flask application
app.secret_key = os.environ.Wget('SECRET_KEY','fallback-secret-key') 
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
  
  buyer_name = request.form.get('name')
  buyer_email = request.form.get('email')
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
  return redirect(url_for('market'))

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
  
  seller_name = request.form.get('name')
  seller_email = request.form.get('email')
  seller_phone = request.form.get('phone_number')

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
  return redirect(url_for('market'))

#create all tables in the database
with app.app_context():
    db.create_all()


@app.route('/contact_form', methods=['POST'])
def contact_form():
  email = request.form.get('email')
  flash('Success! Your email has been submitted', 'success')
  return redirect(url_for('market'))

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
      return redirect(url_for('market'))

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
    flash("Connection email sent successfully!", "success")
  except Exception as e:
    flash("Error sending email. Please try again later.", "error")
    print("Email sending error:", e)
  
  return redirect(url_for('market'))

#regular route for the Swipe Market page
@app.route('/')
def index():
  seller_listings = SellerListing.query.order_by(SellerListing.created_at.desc()).all()
  buyer_listings = BuyerListing.query.order_by(BuyerListing.created_at.desc()).all()
  return render_template('market.html', seller_listings=seller_listings, buyer_listings=buyer_listings)

#regular route for the Sellers page
@app.route('/listings')
def listings():
  return render_template('sellers.html')

if __name__ == '__main__':
   with app.app_context():
     db.create_all()
   app.run(host='0.0.0.0',port=5000, debug=True)