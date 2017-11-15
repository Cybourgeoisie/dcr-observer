BEGIN;

CREATE TABLE "block" (
	"block_id"     BIGSERIAL PRIMARY KEY,
	"hash"         TEXT,
	"height"       BIGINT,
	"time"         TIMESTAMP WITHOUT TIME ZONE,
	"version"      BIGINT,
	"merkleroot"   TEXT,
	"stakeroot"    TEXT,
	"stakeversion" BIGINT,
	"extradata"    TEXT,
	"votebits"     TEXT,
	"finalstate"   TEXT,
	"voters"       INTEGER,
	"freshstake"   INTEGER,
	"revocations"  INTEGER,
	"poolsize"     BIGINT,
	"bits"         TEXT,
	"sbits"        TEXT
);

CREATE TABLE "tx" (
	"tx_id"      BIGSERIAL PRIMARY KEY,
	"block_id"   BIGINT REFERENCES "block" (block_id),
	"hash"       TEXT, -- This is "txid"
	"tree"       INTEGER, -- Might want an index on this
	"blockindex" BIGINT,
	"version"    BIGINT,
	"locktime"   BIGINT,
	"expiry"     BIGINT
);

-- Can't be unique, apparently
-- DROP INDEX tx_hash_idx;
CREATE INDEX tx_hash_idx ON tx (hash);

CREATE TABLE "vout" (
	"vout_id"     BIGSERIAL PRIMARY KEY,
	"tx_id"       BIGINT REFERENCES "tx" (tx_id),
	"value"       NUMERIC,
	"commitamt"   NUMERIC,
	"n"           BIGINT,
	"version"     BIGINT,
	"type"        TEXT,
	"asm"         TEXT,
	"hex"         TEXT,
	"reqSigs"     INTEGER,
	"key"         VARCHAR(22) UNIQUE -- Used for definitive insert matching ("{blockheight}-{tree}-{blockindex}-{n}")
);

-- ALTER TABLE vout DROP CONSTRAINT vout_key_key;
-- CREATE INDEX vout_key_key ON vout (key);
-- NOPE. Put it back.
-- ALTER TABLE vout ADD CONSTRAINT vout_key_key UNIQUE (key);

CREATE TABLE "address" (
	"address_id"  BIGSERIAL PRIMARY KEY,
	"address"     VARCHAR(80) UNIQUE
);

CREATE TABLE "vout_address" (
	"vout_address_id" BIGSERIAL PRIMARY KEY,
	"vout_id"         BIGINT REFERENCES "vout" (vout_id),
	"address_id"      BIGINT REFERENCES "address" (address_id)
);

CREATE TABLE "vin" (
	"vin_id"      BIGSERIAL PRIMARY KEY,
	"tx_id"       BIGINT REFERENCES "tx" (tx_id),
	"vout_id"     BIGINT REFERENCES "vout" (vout_id),
	"amountin"    NUMERIC,
	"blockheight" BIGINT,
	"tree"        INTEGER,
	"blockindex"  BIGINT,
	"vout"        INTEGER,
	"coinbase"    TEXT,
	"stakebase"   TEXT,
	"sequence"    BIGINT,
	"asm"         TEXT,
	"hex"         TEXT
);

COMMIT;