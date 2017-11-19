BEGIN;

CREATE TABLE "hd_network" (
	"hd_network_id"  BIGSERIAL PRIMARY KEY,
	"network"        BIGINT
);

CREATE TABLE "hd_network_address" (
	"hd_network_address_id" BIGSERIAL PRIMARY KEY,
	"hd_network_id"         BIGINT REFERENCES "hd_network" (hd_network_id),
	"address_id"            BIGINT REFERENCES "address" (address_id)
);

COMMIT;
