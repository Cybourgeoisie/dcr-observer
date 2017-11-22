BEGIN;

ALTER TABLE "address" ADD COLUMN "network" BIGINT;
CREATE INDEX "address_network_idx" ON address (network);
UPDATE address SET network = address_id;

CREATE TABLE "tx_network" (
    "tx_network_id" BIGSERIAL PRIMARY KEY,
    "tx_id"         BIGINT UNIQUE REFERENCES "tx" (tx_id),
    "network"       BIGINT
);

CREATE INDEX tx_network_network_idx ON tx_network (network);

-- Create the basic networks and start by setting them all to the same address
INSERT INTO tx_network (tx_id, network) SELECT tx_id, 9223372036854775800 FROM tx ON CONFLICT DO NOTHING;

-- to reset
--UPDATE tx_network SET network = 9223372036854775800;


--
-- NOW YOU NEED TO FOLLOW THE LOGIC WITHIN "collectHdWallets.sql"
-- Determining the connected addresses is like finding the minimum value
-- of a function - it has to be performed iteratively to get closer and 
-- closer to the true state of the system.
--


CREATE TABLE "hd_network" (
    "hd_network_id"  BIGSERIAL PRIMARY KEY,
    "address_id"     BIGINT UNIQUE REFERENCES "address" (address_id),
    "network"        BIGINT UNIQUE,
    "balance"        NUMERIC,
    "rank"           BIGINT,
    "num_addresses"  BIGINT
);

-- ALTER TABLE hd_network ADD COLUMN rank BIGINT;
-- ALTER TABLE hd_network ADD COLUMN num_addresses BIGINT;
-- ALTER TABLE hd_network ADD COLUMN address_id BIGINT UNIQUE REFERENCES "address" (address_id);
-- CREATE INDEX hd_network_network_idx ON hd_network (network);
-- CREATE INDEX hd_network_address_id_idx ON hd_network (address_id);
-- CREATE INDEX hd_network_rank_idx ON hd_network (rank);

COMMIT;


ALTER TABLE hd_network DISABLE TRIGGER ALL;

INSERT INTO 
    "hd_network" (network, balance)
SELECT
    DISTINCT ON (a.network)
    a.network,
    SUM(b.balance) AS balance
FROM
    address a
JOIN
    balance b ON b.address_id = a.address_id
GROUP BY
    a.network
ON CONFLICT DO NOTHING;

ALTER TABLE hd_network ENABLE TRIGGER ALL;


-- THE FOLLOWING WILL BE ADDED TO THE DATABASE UPDATE ROUTINE --

BEGIN;

UPDATE
    hd_network
SET
    balance = sq.balance
FROM (
    SELECT
        DISTINCT ON (a.network)
        a.network,
        SUM(b.balance) AS balance
    FROM
        address a
    JOIN
        balance b ON b.address_id = a.address_id
    GROUP BY
        a.network
) AS sq
WHERE
    hd_network.network = sq.network;

UPDATE
  hd_network
SET
  rank = sq.rank
FROM (
  SELECT
    network,
    RANK() OVER(ORDER BY balance DESC) AS rank
  FROM
    hd_network
) AS sq
WHERE
  hd_network.network = sq.network;

UPDATE
  hd_network
SET
  num_addresses = sq.num_addresses
FROM (
    SELECT
        network,
        COUNT(DISTINCT address_id) AS num_addresses
    FROM 
        address
    GROUP BY
        network
) AS sq
WHERE
  hd_network.network = sq.network;

UPDATE
  hd_network
SET
  address_id = sq.address_id
FROM (
    SELECT 
        DISTINCT ON (a.network)
        a.network,
        a.address_id
    FROM
        address a
    JOIN
        balance b ON b.address_id = a.address_id
    ORDER BY
        a.network, b.balance DESC
) AS sq
WHERE
  hd_network.network = sq.network;

COMMIT;
