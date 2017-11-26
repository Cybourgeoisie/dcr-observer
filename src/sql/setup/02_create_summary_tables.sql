BEGIN;

CREATE TABLE "balance" (
	"balance_id"               BIGSERIAL PRIMARY KEY,
	"address_id"               BIGINT UNIQUE REFERENCES "address" (address_id),
	"first_block_id"           BIGINT REFERENCES "block" (block_id), -- First time we've seen this address
	"last_block_id"            BIGINT REFERENCES "block" (block_id), -- Used to make sure we don't double count
	"rank"                     BIGINT, -- current ranking among all balances
	"balance"                  NUMERIC DEFAULT 0, -- value = (vout - vin)
	"vout"                     NUMERIC DEFAULT 0, -- all vout outputs to this address (putting value in)
	"vin"                      NUMERIC DEFAULT 0, -- all vin inputs from this address (moving value out)
	"tx"                       BIGINT DEFAULT 0, -- count of all txes
	"vout_count"               BIGINT DEFAULT 0, -- # of vouts this address shows up in
	"vin_count"                BIGINT DEFAULT 0, -- # of vins this address shows up in
	"svout"                    NUMERIC DEFAULT 0, -- all staking vout outputs to this address (putting value in)
	"svin"                     NUMERIC DEFAULT 0, -- all staking vout outputs to this address (putting value in)
	"stx"                      BIGINT DEFAULT 0, -- count of only staking txes
	"svout_count"              BIGINT DEFAULT 0, -- # of staking vouts this address shows up in
	"svin_count"               BIGINT DEFAULT 0, -- # of staking vins this address shows up in
	"liquid"                   NUMERIC DEFAULT 0, -- all moveable funds
	"active_stake_submissions" NUMERIC DEFAULT 0 -- all stakesubmissions that don't have vins
);

ALTER TABLE balance ALTER COLUMN "balance"                  SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "vout"                     SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "vin"                      SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "tx"                       SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "vout_count"               SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "vin_count"                SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "svout"                    SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "svin"                     SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "stx"                      SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "svout_count"              SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "svin_count"               SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "liquid"                   SET DEFAULT 0;
ALTER TABLE balance ALTER COLUMN "active_stake_submissions" SET DEFAULT 0;


CREATE INDEX balance_rank_idx ON balance (rank);
CREATE INDEX balance_balance_idx ON balance (balance);
CREATE INDEX balance_address_id_idx ON balance (address_id);
CREATE INDEX balance_first_block_id_idx ON balance (first_block_id);
CREATE INDEX balance_last_block_id_idx ON balance (last_block_id);

-- Later
--ALTER TABLE "balance" DROP COLUMN "vout_count";
--ALTER TABLE "balance" DROP COLUMN "vin_count";
--ALTER TABLE "balance" DROP COLUMN "svout_count";
--ALTER TABLE "balance" DROP COLUMN "svin_count";

ALTER TABLE "balance" ADD COLUMN "liquid" NUMERIC;
ALTER TABLE "balance" ADD COLUMN "active_stake_submissions" NUMERIC;

CREATE TABLE "balance_rank" (
	"balance_rank_id" BIGSERIAL PRIMARY KEY,
	"balance_id"      BIGINT UNIQUE REFERENCES "balance" (balance_id),
	"rank"            BIGINT
);

-- CREATE INDEX balance_rank_balance_id_idx ON balance_rank (balance_id);

TRUNCATE TABLE "balance_rank" RESTART IDENTITY;
EXPLAIN ANALYZE INSERT INTO balance_rank ("balance_id", "rank") SELECT balance_id, RANK() OVER(ORDER BY "balance" DESC) AS rank FROM balance;


COMMIT;