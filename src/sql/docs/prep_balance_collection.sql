-- Fields needed:
-- block:
	-- start, end, first, last
-- vout:
	-- out, sout
-- vin:
	-- in, sin
-- tx:
	-- tx, stx
-- cumulative:
	-- val, rank

-- All vouts
SELECT
	DISTINCT ON (tx.tree)
	coalesce(count(DISTINCT vout.vout_id), 0) AS vout_count,
	coalesce(sum(vout.value), 0) AS vout_value
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
JOIN
	tx ON tx.tx_id = vout.tx_id
WHERE
	address = '$1';

-- All vins
SELECT
	DISTINCT ON (tx.tree)
	coalesce(count(DISTINCT vin.vin_id), 0) AS vin_count,
	coalesce(sum(vin.amountin), 0) AS vin_amountin
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vin ON vin.vout_id = va.vout_id
JOIN
	tx ON tx.tx_id = vout.tx_id
WHERE
	address = '$1';

-- For staking
JOIN
	vin ON vin.vout_id = va.vout_id AND tx.tree = 1

-- Get block and tx information
SELECT
	sq.address_id,
	sq.first_block_id,
	sq.last_block_id,
	sq.tx_count AS tx,
	b_start.time AS "start",
	b_end.time AS "end"
FROM (
	SELECT
		DISTINCT (a.address_id),
		count(DISTINCT tx.tx_id) AS tx_count,
		min(tx.block_id) AS first_block_id,
		max(tx.block_id) AS last_block_id
	FROM
		address a
	JOIN
		vout_address va ON va.address_id = a.address_id
	JOIN
		vout ON vout.vout_id = va.vout_id
	LEFT JOIN
		vin ON vin.vout_id = va.vout_id
	JOIN
		tx ON (tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id)
	WHERE
		a.address = ''
	GROUP BY
		a.address_id
) AS sq
JOIN
	block b_start ON b_start.block_id = sq.first_block_id
JOIN
	block b_end ON b_end.block_id = sq.last_block_id;

-- Get staking count information
SELECT
	DISTINCT (a.address_id),
	count(DISTINCT tx.tx_id) AS stx_count
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
LEFT JOIN
	vin ON vin.vout_id = va.vout_id
JOIN
	tx ON (tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id) AND tx.tree = 1
GROUP BY
	a.address_id;


-- Get staking vouts
SELECT
	DISTINCT (a.address_id),
	coalesce(count(DISTINCT vout.vout_id), 0) AS svout_count,
	coalesce(sum(vout.value), 0) AS svout_value
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vout ON vout.vout_id = va.vout_id
JOIN
	tx ON (tx.tx_id = vout.tx_id) AND tx.tree = 1
GROUP BY
	a.address_id;

SELECT
	DISTINCT (a.address_id),
	coalesce(count(DISTINCT vin.vin_id), 0) AS svin_count,
	coalesce(sum(vin.amountin), 0) AS svin_amountin
FROM
	address a
JOIN
	vout_address va ON va.address_id = a.address_id
JOIN
	vin ON vin.vout_id = va.vout_id
JOIN
	tx ON (tx.tx_id = vin.tx_id) AND tx.tree = 1
GROUP BY
	a.address_id;

