BEGIN;

CREATE TABLE "balance" (
	"balance_id"     BIGSERIAL PRIMARY KEY,
	"address_id"     BIGINT UNIQUE REFERENCES "address" (address_id),
	"first_block_id" BIGINT REFERENCES "block" (block_id), -- First time we've seen this address
	"last_block_id"  BIGINT REFERENCES "block" (block_id), -- Used to make sure we don't double count
	"rank"           BIGINT, -- current ranking among all balances
	"balance"        NUMERIC, -- value = (vout - vin)
	"vout"           NUMERIC, -- all vout outputs to this address (putting value in)
	"vin"            NUMERIC, -- all vin inputs from this address (moving value out)
	"tx"             BIGINT, -- count of all txes
	"vout_count"     BIGINT, -- # of vouts this address shows up in
	"vin_count"      BIGINT, -- # of vins this address shows up in
	"svout"          NUMERIC, -- all staking vout outputs to this address (putting value in)
	"svin"           NUMERIC, -- all staking vout outputs to this address (putting value in)
	"stx"            BIGINT, -- count of only staking txes
	"svout_count"    BIGINT, -- # of staking vouts this address shows up in
	"svin_count"     BIGINT  -- # of staking vins this address shows up in
);

CREATE INDEX balance_rank_idx ON balance (rank);
CREATE INDEX balance_address_id_idx ON balance (address_id);
CREATE INDEX balance_first_block_id_idx ON balance (first_block_id);
CREATE INDEX balance_last_block_id_idx ON balance (last_block_id);

COMMIT;