BEGIN;

CREATE TABLE "block" (
	"block_idx"    BIGSERIAL PRIMARY KEY,
	"hash"         TEXT,
	"height"       BIGINT,
	"version"      INTEGER,
	"merkleroot"   TEXT,
	"stakeroot"    TEXT,
	"time"         TIMESTAMP WITHOUT TIME ZONE,
	"stakeversion" INTEGER,
	"extradata"    TEXT,
	"votebits"     INTEGER,
	"finalstate"   TEXT,
	"voters"       INTEGER,
	"freshstake"   INTEGER,
	"revocations"  INTEGER,
	"poolsize"     INTEGER,
	"bits"         TEXT,
	"sbits"        TEXT
);

CREATE TABLE "tx" (
	"tx_idx"     BIGSERIAL PRIMARY KEY,
	"block_idx"  BIGINT REFERENCES "block" (block_idx),
	"hash"       TEXT, -- This is "txid"
	"tree"       INTEGER, -- Might want an index on this
	"blockindex" INTEGER,
	"version"    BIGINT,
	"locktime"   BIGINT,
	"expiry"     BIGINT
);

CREATE TABLE "vout" (
	"vout_idx"    BIGSERIAL PRIMARY KEY,
	"tx_idx"      BIGINT REFERENCES "tx" (tx_idx),
	"value"       NUMERIC,
	"commitamt"   NUMERIC,
	"n"           INTEGER,
	"version"     INTEGER,
	"type"        TEXT,
	"asm"         TEXT,
	"hex"         TEXT,
	"reqSigs"     INTEGER
);

CREATE TABLE "address" (
	"address_idx" BIGSERIAL PRIMARY KEY,
	"address"     TEXT UNIQUE
);

CREATE TABLE "vout_address" (
	"vout_address_idx" BIGSERIAL PRIMARY KEY,
	"vout_idx"         BIGINT REFERENCES "vout" (vout_idx),
	"address_idx"      BIGINT REFERENCES "address" (address_idx)
);

CREATE TABLE "vin" (
	"vin_idx"     BIGSERIAL PRIMARY KEY,
	"tx_idx"      BIGINT REFERENCES "tx" (tx_idx),
	"vout_idx"    BIGINT REFERENCES "vout" (vout_idx),
	"amountin"    NUMERIC,
	"blockindex"  BIGINT,
	"coinbase"    TEXT,
	"stakebase"   TEXT,
	"sequence"    BIGINT,
	"asm"         TEXT,
	"hex"         TEXT
);

COMMIT;