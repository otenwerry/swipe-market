-- use \i swipe-market/scripts/sum_prices.sql in the psql shell to run.
-- this script sums the prices of all listings in contact_record,
-- giving an upper bound on how much money has moved through 
-- Swipe Market.

SELECT SUM(price) AS total_price
FROM (
	-- handle buyer listings
	SELECT b.price
	FROM contact_record c
	JOIN buyer_listing b
		ON c.listing_id = b.id
	WHERE c.listing_type = 'buyer'

	-- combine results with seller listings
	UNION ALL

	-- handle seller listings
	SELECT s.price
	FROM contact_record c
	JOIN seller_listing s
		ON c.listing_id = s.id
	WHERE c.listing_type = 'seller'

) AS all_prices;
