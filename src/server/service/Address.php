<?php

declare(strict_types=1);

namespace Service;

class Address extends \Scrollio\Service\AbstractService
{
	public function getDetails(string $address)
	{
		throw new \Exception('Not ready for production.');
		return;

		// Validate the address
		$address = preg_replace("/[^A-Za-z0-9]/", '', $address);
		if (strlen($address) < 34 || strlen($address) > 36 || $address[0] != 'D')
		{
			throw new \Exception('Invalid address provided.');
		}

		$sql = '
			SELECT
				sq.address_id,
				$1 AS address,
				sq.tx_count AS tx,
				1 AS rank,
				0 AS stx,
				sq.vout_count,
				sq.vin_count,
				sq.vout_value AS out,
				sq.vin_amountin AS "in",
				sq.vout_value - sq.vin_amountin AS val,
				0 AS sout,
				0 AS sin,
				extract(epoch from b_start.time) AS start,
				extract(epoch from b_end.time) AS "end",
				b_start.height AS first,
				b_end.height AS last
			FROM
				(
					SELECT
						a.address_id,
						count(DISTINCT tx.tx_id) AS tx_count,
						count(vout.tx_id) AS vout_count,
						count(vin.tx_id) AS vin_count,
						sum(vout.value) AS vout_value,
						CASE WHEN vin.vin_id IS NOT NULL THEN sum(vin.amountin) ELSE 0 END AS vin_amountin,
						min(tx.block_id) AS first_block,
						max(tx.block_id) AS last_block
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
					WHERE
						a.address LIKE $1
					GROUP BY
						a.address_id,
						vin.vin_id
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
