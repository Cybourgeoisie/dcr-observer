BEGIN;

CREATE TABLE "database_blockchain_state" (
	"database_blockchain_state_id" BIGSERIAL PRIMARY KEY,
	"last_block_id"                BIGINT REFERENCES "block" (block_id),
	"last_tx_id"                   BIGINT REFERENCES "tx" (tx_id),
	"last_vout_id"                 BIGINT REFERENCES "vout" (vout_id),
	"last_vin_id"                  BIGINT REFERENCES "vin" (vin_id),
	"last_address_id"              BIGINT REFERENCES "address" (address_id),
	"last_vout_address_id"         BIGINT REFERENCES "vout_address" (vout_address_id),
	"total_dcr"                    NUMERIC
);

-- Just to initialize the row
INSERT INTO "database_blockchain_state" (total_dcr) VALUES (0);

-- Now update it
UPDATE database_blockchain_state SET last_block_id = sq.block_id
FROM (SELECT block_id FROM block ORDER BY block_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_tx_id = sq.tx_id
FROM (SELECT tx_id FROM tx ORDER BY tx_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_vout_id = sq.vout_id
FROM (SELECT vout_id FROM vout ORDER BY vout_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_vin_id = sq.vin_id
FROM (SELECT vin_id FROM vin ORDER BY vin_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_address_id = sq.address_id
FROM (SELECT address_id FROM address ORDER BY address_id DESC LIMIT 1) AS sq;

UPDATE database_blockchain_state SET last_vout_address_id = sq.vout_address_id
FROM (SELECT vout_address_id FROM vout_address ORDER BY vout_address_id DESC LIMIT 1) AS sq;

-- Now the fat boy
UPDATE database_blockchain_state SET total_dcr = sq.sum
FROM (SELECT SUM(balance) AS sum FROM balance WHERE balance > 0) AS sq;

COMMIT;