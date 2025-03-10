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
app.secret_key = os.environ.get('SECRET_KEY','fallback-secret-key') 
#app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') # for PostgreSQL
app.config['SQLALCHEMY_DATABASE_URI'] = '***REDACTED***'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME','liondinecu@gmail.com')
app.config['MAIL_DEFAULT_SENDER'] = 'liondinecu@gmail.com'
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD','***REDACTED***')
mail = Mail(app)

ny_tz = pytz.timezone('America/New_York')

dining_halls = [
  "John Jay",
  "JJ's",
  "Ferris",
  "Faculty House",
  "Chef Mike's",
  "Chef Don's",
  "Grace Dodge",
  "Fac Shack", 
  "Hewitt Dining", 
  "Diana",
  "Kosher",
  "Johnny's"
]

#gets dining data from aws s3 json file
def get_dining_data():
  bucket_name = 'liondine-data'
  object_name = 'dining_data.json'
  s3_client = boto3.client('s3')
  #boto3 automatically looks for credentials stored locally
  try:
    response = s3_client.get_object(Bucket=bucket_name, Key=object_name)
    content = response['Body'].read().decode('utf-8')
    data = json.loads(content)
    return data
  except Exception as e:
    print(f"Error fetching data from AWS S3: {e}")
    return {}


#takes the dictionary of all food items and filters it to only include
#stations that are currently open
def current_open_stations(now):
  halls = get_dining_data()
  print(halls)
  filtered_halls = {} #to be filled

  #if a dining hall is closed, give it value "Closed" instead of a list of food
  #the following functions are from the time_functions.py file
  closed_check = [
    ("John Jay", john_jay_open),
    ("JJ's", jjs_open),
    ("Ferris", ferris_open),
    ("Faculty House", fac_house_open),
    ("Chef Mike's", mikes_open),
    ("Chef Don's", dons_open),
    ("Grace Dodge", grace_dodge_open),
    ("Fac Shack", fac_shack_open),
    ("Hewitt Dining", hewitt_open),
    ("Diana", diana_open),
    ("Johnny's", johnnys_open)
    ]
  
  hours = hours_dict(now.weekday())

  for hall_name, is_open_func in closed_check:
    # Initialize with hours for all halls
    filtered_halls[hall_name] = {
        "status": "Open" if is_open_func(now) else "Closed",
        "hours": hours.get(hall_name, "Hours not available"),
        "stations": {},
    }

  #for each dining hall, skipping the closed ones, find each station that's currently open and add it to the filtered dictionary
  
  for hall_name, stations in halls.items():
    if hall_name in filtered_halls and filtered_halls[hall_name]["status"].startswith("Closed"):
      continue
    if stations is None:
      filtered_halls[hall_name]["stations"] = "Missing data"
      continue
  
    filtered_stations = {}
    
    #here, we hard-code the times of each station of each dining hall.
    if hall_name == "John Jay":
      if now.weekday() == 6:
        if 10 <= now.hour and now.hour < 11 or (now.hour == 9 and now.minute >= 30):
          for station, items in stations.get('brunch',{}).items():
            filtered_stations[station] = items
        if 11 <= now.hour and now.hour < 14 or (now.hour == 14 and now.minute < 30):
          for station, items in stations.get('lunch',{}).items():
            filtered_stations[station] = items
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
        if 17 <= now.hour and now.hour < 21:
          for station, items in stations.get('dinner',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
      if now.weekday() in [0, 1, 2, 3]:
        if 10 <= now.hour and now.hour < 11 or (now.hour == 9 and now.minute >= 30):
          for station, items in stations.get('breakfast',{}).items():
            filtered_stations[station] = items
      
        if 11 <= now.hour and now.hour < 14 or (now.hour == 14 and now.minute < 30):
          for station, items in stations.get('lunch',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
        if 17 <= now.hour and now.hour < 21:
          for station, items in stations.get('dinner',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
        #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"
    
    if hall_name == "JJ's":
      #filter for only open stations
      #filtered_stations["all hours"] = "12 pm - 10 am"
      if now.hour >= 12 or now.hour < 4:
        for station, items in stations.get('lunch & dinner',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:
            filtered_stations[station] = items
      if now.hour > 22 or now.hour < 4:
        for station, items in stations.get('late night',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
      if now.hour >= 4 and now.hour < 10:
        for station, items in stations.get('breakfast',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"

    if hall_name == "Ferris":
      if now.weekday() in [0,1,2,3,4]:
        #filtered_stations["all hours"] = "7:30 am - 8 pm"
        if now.hour > 7 and now.hour < 11 or (now.hour == 7 and now.minute >= 30):
          for station, items in stations.get('breakfast',{}).items():
            filtered_stations[station] = items
        if now.hour >= 11 and now.hour < 16:
          for station, items in stations.get('lunch',{}).items():
            filtered_stations[station] = items
        if now.hour >= 17 and now.hour < 20:
          for station, items in stations.get('dinner',{}).items():
            filtered_stations[station] = items
        if now.hour >= 11 and now.hour < 20:
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
      if now.weekday() == 5:
        if now.hour <= 11 and (now.hour > 9):
          for station, items in stations.get('breakfast',{}).items():
            filtered_stations[station] = items
        if now.hour >= 11 and now.hour < 2:
          for station, items in stations.get('lunch',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
        if now.hour >= 17 and now.hour < 20:
          for station, items in stations.get('dinner',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
      if now.weekday() == 6:
        #filtered_stations["all hours"] = "10 am - 2 pm, 5 pm - 8 pm"
        if (now.hour == 7 and now.minute >= 30) or (now.hour >= 8 and now.hour < 11):
          for station, items in stations.get('breakfast', {}).items():
            filtered_stations[station] = items

        if now.hour >= 11 and now.hour < 14:
          for station, items in stations.get('lunch',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
        if now.hour >= 17 and now.hour < 20:
          for station, items in stations.get('dinner',{}).items():
            filtered_stations[station] = items
          for station, items in stations.get('lunch & dinner',{}).items():
            filtered_stations[station] = items
    #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
        #filtered_halls[hall_name]["stations"]["Missing Data"] = ""
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"

    if hall_name == "Faculty House":
      #filter for only open stations
      #filtered_stations["all hours"] = "11 am - 2:30 pm"
      for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"

    if hall_name == "Chef Mike's":
      for station, items in stations.get('lunch & dinner',{}).items():
        filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
        #filtered_halls[hall_name]["stations"]["Missing Data"] = ""
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"    

    if hall_name == "Chef Don's":
      #filtered_stations["all hours"] = "8 am - 6 pm"
      if now.hour >= 8 and now.hour < 11:
        filtered_stations["Breakfast"] = ["Bacon egg and cheese bagel", "Ham egg and cheese bagel", "Vegan breakfast bagel", "Cup of oatmeal", "Piece of fruit","Danish pastry","Small coffee or tea"]
      if now.hour >= 11 and now.hour < 18:
        filtered_stations["Lunch/Dinner Service"] = ["Build your own pizza", "Toasted Cuban sandwich", "Piece of fruit", "Milkshake or Freestyle machine beverage", "Dessert"]
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"

    if hall_name == "Grace Dodge":
      #filter for only open stations
      for station, items in stations.get('lunch & dinner',{}).items():
        filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"
    
    if hall_name == "Fac Shack":
      if now.weekday() < 4:
        #filtered_stations["all hours"] = "11 am - 2 pm"
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
      if now.weekday() in [3,4,5] and now.hour >= 19 and now.hour < 23:
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station] = items
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"
    if hall_name == "Johnny's":
      if(now.weekday() <= 4):
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station]["stations"] = items
      elif now.weekday() >= 4 and now.weekday() < 6:
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station]["stations"] = items
      
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"    

    
    if hall_name == "Hewitt Dining":
      if (now.weekday() in [0, 1, 2, 3, 4] and ((now.hour > 7 and now.hour < 10) or now.hour == 7 and now.minute > 30)) or (now.weekday() in [5, 6] and ((now.hour > 10 and now.hour < 12) or (now.hour == 10 and now.minute > 30))):
        for station, items in stations.get('breakfast',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('every day',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
      if (now.weekday() in [0, 1, 2, 3, 4] and ((now.hour >= 11 and now.hour < 14) or (now.hour == 14 and now.minute < 30))) or (now.weekday() in [5, 6] and (now.hour > 12 and now.hour < 15)):
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('every day',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
      if (now.hour > 16 and now.hour < 30) or (now.hour == 16 and now.minute > 30):
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('every day',{}).items():
          filtered_stations[station] = items
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"
      
    if hall_name == "Diana":
      if (now.weekday() in [0, 1, 2, 3] and ((now.hour >= 9 and now.hour < 11) or (now.hour == 11 and now.minute < 30))) or (now.weekday() == 4 and (now.hour >= 9 and now.hour < 12)):
        for station, items in stations.get('breakfast',{}).items():
          filtered_stations[station] = items  
      if (now.weekday() in [0, 1, 2, 3] and ((now.hour > 11 and now.hour < 17) or (now.hour == 11 and now.minute > 30))) or (now.weekday() == 4 and (now.hour >= 12 and now.hour < 15) or (now.weekday() == 6 and (now.hour >= 12 and now.hour < 17))):
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station]["stations"] = items   
      if now.weekday() in [0, 1, 2, 3, 6] and ((now.hour >= 17 and now.hour < 20)):
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station]["stations"] = items       
      if now.weekday() in [0, 1, 2, 3] and (now.hour >= 20):
        for station, items in stations.get('late night',{}).items():
          filtered_stations[station] = items

      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing Data"
  
  return filtered_halls

#takes the dictionary of all food items and filters it to only include
#stations that are open at the given meal

def open_at_meal(now, meal):
  halls = get_dining_data()
  print("Dining hall names: ", halls.keys())
  print(halls)
  filtered_halls = {} #to be filled

  for hall_name in dining_halls:
    filtered_halls[hall_name] = {
      'status': 'Unknown',
      'hours': 'Hours not available',
      'stations': {},
    }

  # CHECKS FOR CLOSED
  
  b_hours = breakfast_hours(now.weekday(), now)
  l_hours = lunch_hours(now.weekday(), now)
  d_hours = dinner_hours(now.weekday(), now)
  ln_hours = latenight_hours(now.weekday(), now)

  #filtered_halls[hall_name]["status"] = "Open" if meal in meal_list else f"Closed for {meal}"

  filtered_halls["John Jay"]["status"] = "Open" if now.weekday() in [6,0,1,2,3] else f"Closed for {meal}"
  filtered_halls["JJ's"]["status"] = "Open" #FALL BREAK
  filtered_halls["Ferris"]["status"] = "Open"
  if (now.weekday() <= 3 and meal == "lunch"):
    filtered_halls["Johnny's"]["status"] = "Open"
  elif (now.weekday() in [3, 4, 5] and meal in ["dinner", "latenight"]):
    filtered_halls["Johnny's"]["status"] = "Open"
  else:
    filtered_halls["Johnny's"]["status"] = f"Closed for {meal}"
  if meal == "breakfast":
    filtered_halls["Johnny's"]["status"]= f"Closed for {meal}"
  filtered_halls["Hewitt Dining"]["status"] = "Open"
  if (now.weekday() == 5 and meal in ["breakfast", "lunch", "dinner", "latenight"]):
    filtered_halls["Kosher"]["status"] = f"Closed for {meal}"
  elif (now.weekday() == 4 and meal == "dinner"):
    filtered_halls["Kosher"]["status"] = f"Closed for {meal}"
  else:
    filtered_halls["Kosher"]["status"] = "Open"
  if now.weekday() in [0,1,2] and meal == "lunch":
    filtered_halls["Faculty House"]["status"] = "Open"
  else:
    filtered_halls["Faculty House"]["status"] = f"Closed for {meal}"
  if now.weekday() in [0,1,2,3,4] and meal in ["lunch","dinner"]:
    filtered_halls["Chef Mike's"]["status"] = "Open"
  else:
    filtered_halls["Chef Mike's"]["status"] = f"Closed for {meal}"
  if now.weekday() in [0,1,2,3,4]:
    filtered_halls["Chef Don's"]["status"] = "Open"
  else:
    filtered_halls["Chef Don's"]["status"] = f"Closed for {meal}"
  if now.weekday() in [0,1,2,3] and meal in ["lunch","dinner"]:
    filtered_halls["Grace Dodge"]["status"] = "Open"
  else:
    filtered_halls["Grace Dodge"]["status"] = f"Closed for {meal}"

  if (now.weekday() in [0,1,2,3] and (meal == "lunch" or meal =="dinner")):
    filtered_halls["Fac Shack"]["status"] = "Open"
  else:
    filtered_halls["Fac Shack"]["status"] = f"Closed for {meal}"
  if (now.weekday() in [0,1,2,3] or (now.weekday() == 4 and meal in ["breakfast", "lunch"]) or 
      now.weekday() == 6 and meal in ["lunch","dinner"]):
    filtered_halls["Diana"]["status"] = "Open"
  elif now.weekday() in [0, 1, 2, 3] and meal == "latenight":
    filtered_halls["Diana"]["status"] = "Open"
  else:
    filtered_halls["Diana"]["status"] = f"Closed for {meal}"
  if meal == "latenight":
    filtered_halls["Ferris"]["status"] = filtered_halls["John Jay"]["status"] = filtered_halls["Faculty House"]["status"] = filtered_halls["Chef Mike's"]["status"] = filtered_halls["Chef Don's"]["status"] = filtered_halls["Hewitt Dining"]["status"] = filtered_halls["Kosher"]["status"] = f"Closed for {meal}"

  for hall_name in halls.keys():
    if meal == "breakfast":
      filtered_halls[hall_name]["hours"] = b_hours.get(hall_name, "Hours not available")
    elif meal == "lunch":
      filtered_halls[hall_name]["hours"] = l_hours.get(hall_name, "Hours not available")
    elif meal == "dinner":
      filtered_halls[hall_name]["hours"] = d_hours.get(hall_name, "Hours not available")
    elif meal == "latenight":
      filtered_halls[hall_name]["hours"] = ln_hours.get(hall_name, "Hours not available")

  #for each dining hall, skipping the closed ones, find each
  #station that's currently open and add it to the filtered dictionary
  for hall_name, stations in halls.items():
    if hall_name in filtered_halls and filtered_halls[hall_name]["status"].startswith("Closed"):
      continue
    filtered_stations = {}
    
    if stations is None:
      filtered_halls[hall_name]["stations"] = "Missing data"
      continue

    #this code will replace the below code once we have all scraped data.
    #here, we hard-code the times of each station of each dining hall.
    if hall_name == "John Jay" or hall_name == "Ferris":
      #filter for only open stations
      if meal == 'breakfast':
        for station, items in stations.get('breakfast',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items         
      if meal == 'lunch':
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
      if meal == 'dinner':
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"  
    if hall_name == "JJ's":
      #filter for only open stations
      if meal == 'breakfast':
        for station, items in stations.get('breakfast',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:
            filtered_stations[station] = items
        for station, items in stations.get('daily',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:
            filtered_stations[station] = items 
      if meal == 'lunch':
        for station, items in stations.get('lunch & dinner',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
        for station, items in stations.get('daily',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
      if meal == 'dinner':
        for station, items in stations.get('daily',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
        for station, items in stations.get('lunch & dinner',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:
            filtered_stations[station] = items
        for station, items in stations.get('late night',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
      if meal == 'latenight':
        for station, items in stations.get('lunch & dinner',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:
            filtered_stations[station] = items
        for station, items in stations.get('late night',{}).items():
          if station in filtered_stations:
            filtered_stations[station].extend(items)
          else:          
            filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"
    if hall_name == "Faculty House" or hall_name == "Johnny's":
      #filter for only open stations
      if meal == 'lunch':
        for station, items in stations.get('lunch',{}).items():
            filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data" 
    if hall_name == "Chef Mike's":
      #filter for only open stations
      if meal == 'lunch' or meal == 'dinner':
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"      
    if hall_name == "Chef Don's":
      if meal == 'breakfast':
        filtered_stations["Sandwiches"] = ["Bacon egg and cheese bagel", "Ham egg and cheese bagel", "Vegan breakfast bagel"]
        filtered_stations["Sides"] = ["Cup of oatmeal", "Piece of fruit","Danish pastry","Small coffee or tea"]
      if meal == 'lunch' or meal == 'dinner':
        filtered_stations["Entree"] = ["Build your own pizza", "Toasted Cuban sandwich"]
        filtered_stations["Sides"] = ["Piece of fruit", "Soup","Milkshake","Freestyle machine beverage", "Dessert"]
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"    
    if hall_name == "Grace Dodge":
      #filter for only open stations
      if meal == 'lunch' or meal == 'dinner':
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
        
      #return data to the filtered dictionary
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"
    if hall_name == "Fac Shack":
      if meal == 'lunch':
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
      if meal == 'dinner' or meal == 'latenight':
        for station, items in stations.get('lunch & dinner',{}).items():
          filtered_stations[station] = items
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data TEST"
    if hall_name == "Hewitt Dining":
      if meal == 'breakfast':
        for station, items in stations.get('breakfast',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
      elif meal == 'lunch':
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
      elif meal == 'dinner':
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station] = items
      for station, items in stations.get('every day',{}).items():
        filtered_stations[station] = items
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"
    if hall_name == "Kosher":
      if meal == 'breakfast':
        for station, items in stations.get('breakfast',{}).items():
          filtered_stations[station] = items
      if meal == 'lunch':
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
      if meal == 'dinner':
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station] = items
    if hall_name == "Diana":
      if meal == 'breakfast':
        for station, items in stations.get('breakfast',{}).items():
          filtered_stations[station] = items
      if meal == 'lunch':
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('lunch',{}).items():
          filtered_stations[station] = items
      if meal == 'dinner':
        for station, items in stations.get('brunch',{}).items():
          filtered_stations[station] = items
        for station, items in stations.get('dinner',{}).items():
          filtered_stations[station] = items
      if meal == 'latenight':
        for station, items in stations.get('late night',{}).items():
          filtered_stations[station] = items
      if filtered_stations:
        filtered_halls[hall_name]["stations"] = filtered_stations
      else:
        filtered_halls[hall_name]["stations"] = "Missing data"
  
  return filtered_halls

#mapping URLs to functions that display the HTML we want for that URL
def get_current_time():
  #Helper to fetch or reuse the current time for this request.
  if not hasattr(g, 'now'):
      g.now = datetime.now(ny_tz)
  return g.now

@app.before_request
def set_current_time():
  #Set the current time once per request.
  g.now = datetime.now(ny_tz)


@app.route('/') 
def index():
  now = get_current_time()
  if now.hour >= 4 and now.hour < 11:
    return breakfast()
  elif now.hour >= 11 and now.hour < 16:
    return lunch()
  elif now.hour >= 16 and now.hour <= 21:
    return dinner()
  else:
    return latenight()
  
@app.route('/breakfast')
def breakfast():
  now = get_current_time()
  filtered_halls = open_at_meal(now, "breakfast")
  return render_template('index.html', halls=filtered_halls, meal="breakfast", current_time=now)

@app.route('/lunch')
def lunch():
  now = get_current_time()
  filtered_halls = open_at_meal(now, "lunch")
  return render_template('index.html', halls=filtered_halls, meal="lunch", current_time=now)

@app.route('/dinner')
def dinner():
  now = get_current_time()
  filtered_halls = open_at_meal(now, "dinner")
  return render_template('index.html', halls=filtered_halls, meal="dinner", current_time=now)

@app.route('/latenight')
def latenight():
  now = get_current_time()
  filtered_halls = open_at_meal(now, "latenight")
  return render_template('index.html', halls=filtered_halls, meal="latenight", current_time=now)


#########
###SWIPE MARKET CODE BELOW
#########

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
@app.route('/market')
def market():
  seller_listings = SellerListing.query.order_by(SellerListing.created_at.desc()).all()
  buyer_listings = BuyerListing.query.order_by(BuyerListing.created_at.desc()).all()
  return render_template('market.html', seller_listings=seller_listings, buyer_listings=buyer_listings)

#regular route for the Sellers page
@app.route('/sellers')
def sellers():
  return render_template('sellers.html')

if __name__ == '__main__':
   with app.app_context():
     db.create_all()
   app.run(host='0.0.0.0',port=5000, debug=True)