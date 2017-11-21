BEGIN;

CREATE TABLE "tx_vote" (
	"tx_vote_id" BIGSERIAL PRIMARY KEY,
	"tx_id"      BIGINT UNIQUE REFERENCES "tx" (tx_id),
	"hex"        TEXT,
	"votes"      VARCHAR(2), -- right now, only 2 hexes are used
	"version"    VARCHAR(4)  -- right now, only 4 hexes are used
);

-- Will need to update the VARCHAR labels in a later version if the above changes

-- CREATE INDEX tx_vote_tx_id_idx ON tx_vote (tx_id);
-- CREATE INDEX tx_vote_issue_idx ON tx_vote (version);

-- Examples of vote bits that show that the version determines what they mean:
-- https://explorer.dcrdata.org/explorer/tx/10b7511a05fa84b20ebb3cbb8da5dd901f00e42a2b9bf6b3ff13c829682162b2
-- https://explorer.dcrdata.org/explorer/tx/c4b7cfa793a901e5eb5389064e564cd54b2a904ed4f5697260c0aadda8e7864e
-- https://explorer.dcrdata.org/explorer/tx/feaec8775fb4e52b1254ad9b594e126990b1044358fa6bef7a453e0c5d803e8b
