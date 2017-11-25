-- Get all vouts, period
SELECT
	COALESCE(SUM(vout.value), 0)
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
WHERE
	a.address = $1;

-- Get all mining values, excluding the genesis block
SELECT
	COALESCE(SUM(vout.value), 0)
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
JOIN
	tx ON tx.tx_id = vout.tx_id AND tx.tree = 0 AND tx.tx_id != 1
JOIN
	vin ON vin.tx_id = tx.tx_id AND vin.coinbase != ''
WHERE
	a.address = $1;


-- Get all staking values
SELECT
	COALESCE(SUM(vout.value), 0)
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id AND vout.type = 'stakegen'
WHERE
	a.address = $1;


-- Get all from genesis block, directly
-- Shortcut assumption - we know that there was one tx for block 1, with tx_id = 1 on prod and dev
SELECT
	COALESCE(SUM(vout.value), 0)
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id AND vout.tx_id = 1
WHERE
	a.address = $1;


-- Get all from genesis block, paid from an address originating at the genesis block
SELECT
	COALESCE(SUM(vout.value), 0)
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
JOIN
	vin ON vin.tx_id = vout.tx_id
JOIN
	vout origin_vout ON origin_vout.vout_id = vin.vout_id AND origin_vout.tx_id = 1
WHERE
	a.address = $1;


-- TODO: Get all from a mining pool



SELECT
	(SELECT
		SUM(vout.value)
	FROM
		address a
	JOIN
		vout_address va ON va.address_id = a.address_id
	JOIN
		vout ON vout.vout_id = va.vout_id
	JOIN
		tx ON tx.tx_id = vout.tx_id AND tx.tree = 0
	JOIN
		vin ON vin.tx_id = tx.tx_id AND vin.coinbase != ''
	WHERE
		a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS coinbase,
	(SELECT
		SUM(vout.value)
	FROM
		address a
	JOIN
		vout_address va ON va.address_id = a.address_id
	JOIN
		vout ON vout.vout_id = va.vout_id AND vout.type = 'stakegen'
	WHERE
		a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS stakebase,
	(SELECT
		SUM(vout.value)
	FROM
		address a
	JOIN
		vout_address va ON va.address_id = a.address_id
	JOIN
		vout ON vout.vout_id = va.vout_id AND vout.tx_id = 1
	WHERE
		a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS genesis,
	(SELECT
		SUM(vout.value)
	FROM
		address a
	JOIN
		vout_address va ON va.address_id = a.address_id
	JOIN
		vout ON vout.vout_id = va.vout_id
	JOIN
		vin ON vin.tx_id = vout.tx_id
	JOIN
		vout origin_vout ON origin_vout.vout_id = vin.vout_id AND origin_vout.tx_id = 1
	WHERE
		a.address = 'DsS5puNwsxaF9HQCSkgg5fLf1cGc1orabMP') AS paid_from_genesis