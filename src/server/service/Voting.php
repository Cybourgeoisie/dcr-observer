<?php

declare(strict_types=1);

namespace Service;

class Voting extends \Scrollio\Service\AbstractService
{
	public function getTopAddresses(int $start = 0, int $end = 0)
	{
		// Get total
		$sql = '
			SELECT
				COUNT(tv.*) AS total
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total
		$total = $res[0]['total'];

		// Get count of all addresses that voted
		$sql = '
			SELECT
				COUNT(DISTINCT origin_vout_address.address_id) AS total_addresses
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout origin_ss_vout ON
					origin_ss_vout.vout_id = vin.vout_id AND 
					origin_ss_vout.type = \'stakesubmission\'
			JOIN
				vin origin_vin ON origin_vin.tx_id = origin_ss_vout.tx_id
			JOIN
				vout_address origin_vout_address ON origin_vout_address.vout_id = origin_vin.vout_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_addresses', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total_addresses
		$total_addresses = $res[0]['total_addresses'];

		$sql = '
			SELECT
				DISTINCT a.address_id,
				a.address,
				COUNT(tv.*) AS num
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout origin_ss_vout ON
					origin_ss_vout.vout_id = vin.vout_id AND 
					origin_ss_vout.type = \'stakesubmission\'
			JOIN
				vin origin_vin ON origin_vin.tx_id = origin_ss_vout.tx_id
			JOIN
				vout_address origin_vout_address ON origin_vout_address.vout_id = origin_vin.vout_id
			JOIN
				address a ON a.address_id = origin_vout_address.address_id
			GROUP BY
				a.address_id
			ORDER BY
				3 DESC
			LIMIT
				200;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top Decred addresses.');
		}

		return array(
			'total' => $total,
			'total_addresses' => $total_addresses,
			'top' => $res
		);
	}

	public function getTopNetworks(int $start = 0, int $end = 0)
	{
		// Get total
		$sql = '
			SELECT
				COUNT(tv.*) AS total
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total
		$total = $res[0]['total'];

		// Get count of all addresses that voted
		$sql = '
			SELECT
				COUNT(DISTINCT a.network) AS total_networks
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout origin_ss_vout ON
					origin_ss_vout.vout_id = vin.vout_id AND 
					origin_ss_vout.type = \'stakesubmission\'
			JOIN
				vin origin_vin ON origin_vin.tx_id = origin_ss_vout.tx_id
			JOIN
				vout_address origin_vout_address ON origin_vout_address.vout_id = origin_vin.vout_id
			JOIN
				address a ON a.address_id = origin_vout_address.address_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_networks', $res[0])) {
			throw new \Exception('Could not collect top ticket networks.');
		}

		// Get the total_networks
		$total_networks = $res[0]['total_networks'];

		$sql = '
			SELECT
				DISTINCT hn.network,
				primary_address.address,
				COUNT(tv.*) AS num
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout origin_ss_vout ON
					origin_ss_vout.vout_id = vin.vout_id AND 
					origin_ss_vout.type = \'stakesubmission\'
			JOIN
				vin origin_vin ON origin_vin.tx_id = origin_ss_vout.tx_id
			JOIN
				vout_address origin_vout_address ON origin_vout_address.vout_id = origin_vin.vout_id
			JOIN
				address a ON a.address_id = origin_vout_address.address_id
			JOIN
				hd_network hn ON hn.network = a.network
			JOIN
				address primary_address ON primary_address.address_id = hn.address_id
			GROUP BY
				hn.network,
				primary_address.address
			ORDER BY
				3 DESC
			LIMIT
				200;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top Decred wallets.');
		}

		return array(
			'total' => $total,
			'total_networks' => $total_networks,
			'top' => $res
		);
	}

	public function getTopStakeAddresses(int $start = 0, int $end = 0)
	{
		// Get total
		$sql = '
			SELECT
				COUNT(tv.*) AS total
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total
		$total = $res[0]['total'];

		// Get count of all addresses that voted
		$sql = '
			SELECT
				COUNT(DISTINCT origin_ss_vout_address.address_id) AS total_addresses
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout_address origin_ss_vout_address ON origin_ss_vout_address.vout_id = vin.vout_id;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res) || !array_key_exists('total_addresses', $res[0])) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		// Get the total_addresses
		$total_addresses = $res[0]['total_addresses'];

		$sql = '
			SELECT
				DISTINCT a.address_id,
				a.address,
				COUNT(tv.*) AS num
			FROM
				tx_vote tv
			JOIN
				database_blockchain_state dbs ON dbs.database_blockchain_state_id = 1
			JOIN
				tx ON tx.tx_id = tv.tx_id AND tx.block_id > dbs.last_block_id - 8064
			JOIN
				vin ON vin.tx_id = tv.tx_id
			JOIN
				vout_address origin_ss_vout_address ON origin_ss_vout_address.vout_id = vin.vout_id
			JOIN
				address a ON a.address_id = origin_ss_vout_address.address_id
			GROUP BY
				a.address_id
			ORDER BY
				3 DESC
			LIMIT
				200;
		';
		$db_handler = \Geppetto\DatabaseHandler::init();
		$res = $db_handler->query($sql, array());

		if (empty($res) || !array_key_exists(0, $res)) {
			throw new \Exception('Could not collect top ticket awardees.');
		}

		return array(
			'total' => $total,
			'total_addresses' => $total_addresses,
			'top' => $res
		);
	}
}
