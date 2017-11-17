SELECT
	CASE
		WHEN balance < 1        THEN 1
		WHEN balance < 10       THEN 2
		WHEN balance < 100      THEN 3
		WHEN balance < 1000     THEN 4
		WHEN balance < 10000    THEN 5
		WHEN balance < 100000   THEN 6
		WHEN balance < 1000000  THEN 7
		WHEN balance < 10000000 THEN 8
	ELSE 0 END AS bin,
	COUNT(*) AS num_addresses,
	SUM(balance) AS total_balance
FROM
	balance
WHERE
	balance > 0
GROUP BY 1;