BEGIN;

CREATE TABLE "hd" (
	"hd_id"          BIGSERIAL PRIMARY KEY,
	"top_address_id" BIGINT REFERENCES "address" (address_id)
);

CREATE TABLE "hd_tx" (
	"hd_tx_id" BIGSERIAL PRIMARY KEY,
	"hd_id"    BIGINT REFERENCES "hd" (hd_id),
	"tx_id"    BIGINT REFERENCES "tx" (tx_id)
);

foreach tx
 create hd wallet

foreach hd wallet
 check vins for overlapping address_ids from vout_address



INSERT INTO network_tx (tx_id) VALUES (SELECT tx_id FROM tx WHERE vout_id IS NOT NULL);

-- Group all addresses by transactions
INSERT INTO network_tx
	(parent_network_id, tx_id)
VALUES (
	SELECT
		CASE WHEN (ha.address_id IS NULL) THEN
			hd_tx.hd_id
		ELSE
			MIN(ha.hd_id)
		END,
		sq.tx_id
	FROM (
		SELECT
			tx.tx_id,
			va.address_id
		FROM
			tx
		JOIN
			vin ON vin.tx_id = tx.tx_id
		JOIN
			vout_address va ON va.vout_id = vin.vout_id
		GROUP BY
			tx.tx_id,
			va.address_id
	) AS sq
	JOIN
		hd_tx ON hd_tx.tx_id = sq.tx_id
	LEFT JOIN
		hd_address ha ON ha.address_id = sq.address_id
);

;

-- Easy lookup of address to HD wallet?
SELECT
	DISTINCT ON (hd.hd_id, tx.tx_id)
	hd.hd_id,
	tx.tx_id
FROM
	hd
JOIN
	hd_tx ON hd_tx.tx_id = hd.hd_id
JOIN
	tx ON tx.tx_id = hd_tx.tx_id

SELECT
	hd_id
FROM
	hd_tx
WHERE
	address in tx

