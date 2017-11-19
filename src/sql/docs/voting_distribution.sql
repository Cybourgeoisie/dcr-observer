-- Voting distribution

-- Get all stakes that haven't been called yet
SELECT
	SUM(b.balance) AS total_staking,
	SUM(b.vout) AS total_received,
	SUM(b.vin) AS total_sent,
	COUNT(va.vout_id) AS total_tickets
FROM
	balance b
JOIN
	vout_address va ON va.address_id = b.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
WHERE
	vout.type = 'stakesubmission' AND b.balance > 0;