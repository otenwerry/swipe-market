# Swipe Market

<a href="https://swipemarketcu.com/">Swipe Market</a> helps Columbia students buy and sell meal swipes. At the end of the year, dining hall users often end up with lots of leftover swipes on their accounts, and at the same time, plenty of upperclassmen have no meal plan at all and are willing to buy individual swipes at discounted rates. Launched April 21, 2025.

Anybody with a Columbia or Barnard email can log in to post a listing, specifying interest in selling or buying a swipe at some dining hall at some time for some amount of money. Anybody else with a Columbia or Barnard email can click on a listing to automatically generate an email to both themselves and the person who posted it. Once contact information has been exchanged, the two parties coordinate a meeting for the seller to swipe the buyer into a dining hall. 

# How it works

- Flask app with routes to a home page, post listings page, profile page, and edit your listing page
- Login functionality through Google Authentication API
- Emails automatically sent to buyers and sellers through Gmail API
- User profiles and listings stored in a Postgres instance hosted on Render
- Hosted on a Render Web Service
