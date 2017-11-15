<?php

declare(strict_types=1);

class BackgroundCollector
{
/*
"balance_id"     BIGSERIAL PRIMARY KEY,
"address_id"     BIGINT REFERENCES "address" (address_id),
"first_block_id" BIGINT REFERENCES "block" (block_id), -- First time we've seen this address
"last_block_id"  BIGINT REFERENCES "block" (block_id), -- Used to make sure we don't double count
"rank"           BIGINT, -- current ranking among all balances
"balance"        BIGINT, -- value = (vout - vin)
"vout"           BIGINT, -- all vout outputs to this address (putting value in)
"vin"            BIGINT, -- all vin inputs from this address (moving value out)
"tx"             BIGINT, -- count of all txes
"vout_count"     BIGINT, -- # of vouts this address shows up in
"vin_count"      BIGINT, -- # of vins this address shows up in
"svout"          BIGINT, -- all staking vout outputs to this address (putting value in)
"svin"           BIGINT, -- all staking vout outputs to this address (putting value in)
"stx"            BIGINT, -- count of only staking txes
"svout_count"    BIGINT, -- # of staking vouts this address shows up in
"svin_count"     BIGINT  -- # of staking vins this address shows up in
*/

	public function compileBalances()
	{
		// First, let's collect all addresses and basic information



		$sql = '
			SELECT
				sq.address_id,
				sq.first_block_id,
				sq.last_block_id,
				-- rank
				sq.vout_value - sq.vin_amountin AS balance,
				sq.vout_value AS vout,
				sq.vin_amountin AS vin,
				sq.tx_count AS tx,
				sq.vout_count,
				sq.vin_count,

				0 AS stx,
				
				0 AS sout,
				0 AS sin,
				extract(epoch from b_start.time) AS start,
				extract(epoch from b_end.time) AS "end",
			FROM
				(
					SELECT
						DISTINCT a.address_id,
						count(DISTINCT tx.tx_id) AS tx_count,
						count(vout.tx_id) AS vout_count,
						count(vin.tx_id) AS vin_count,
						CASE WHEN vout.value IS NOT NULL THEN sum(vout.value) ELSE 0 END AS vout_value,
						CASE WHEN vin.amountin IS NOT NULL THEN sum(vin.amountin) ELSE 0 END AS vin_amountin,
						min(tx.block_id) AS first_block_id,
						max(tx.block_id) AS last_block_id,
						count(DISTINCT stx.tx_id) AS stx_count,
						count(svout.tx_id) AS svout_count,
						count(svin.tx_id) AS svin_count
					FROM
						address a
					JOIN
						vout_address va ON va.address_id = a.address_id
					JOIN
						vout ON vout.vout_id = va.vout_id
					LEFT JOIN
						vin ON vin.vout_id = va.vout_id
					JOIN
						tx ON tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id
					JOIN
						tx AS stx ON 
							(tx.tx_id = vout.tx_id OR tx.tx_id = vin.tx_id) AND
							stx.tree = 1 -- staking only
					LEFT JOIN
						vout AS svout ON svout.vout_id = va.vout_id AND svout.tx_id = stx.tx_id
					LEFT JOIN
						vin AS svin ON svin.vout_id = va.vout_id AND svin.tx_id = stx.tx_id
					GROUP BY
						a.address_id,
						vout.value,
						vin.amountin
				) AS sq
			JOIN
				block b_start ON b_start.block_id = sq.first_block
			LEFT JOIN
				block b_end ON b_end.block_id = sq.last_block;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array($address));

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('address_id', $res[0])) {
			throw new \Exception('Could not find address.');
		}

		return array(
			'addr_info' => $res[0]
		);

		return array(
			'addr_info' => array(
				'address' => $address,
				'start'   => 1000000,
				'end'     => 10000000,
				'last'    => 1,
				'first'   => 1000,
				'out'     => 100,
				'in'      => 200,
				'tx'      => 5,
				'stx'     => 3,
				'sout'    => 50,
				'sin'     => 50,
				'val'     => 100,
				'rank'    => 0
		));
	}
}
