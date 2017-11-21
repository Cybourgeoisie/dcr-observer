var fs = require('fs');

var savefile = "../../../dcr_db_vote_loader_savefile.json";
var blockdir = '../../../blocks/';

// If we have a save state, use it
fs.exists(savefile, function(exists) {
	if (!exists) {
		processBlocks(1);
	} else {
		console.log("Using save state.");
		fs.readFile(savefile, function(err, data) {
			if (err) {
				console.log("Could not read save state file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var save_state = JSON.parse(data);

				// Report height
				console.log("Starting at height " + save_state.height + ".");

				// Now process the blocks
				processBlocks(save_state.height);
			}
		});
	}
});

function processBlocks(height) {
	var next_height = height;
	while (next_height) {
		height = next_height;
		if (height%10000==0) {
			console.log("hrtbt@" + next_height);
		}

		/*
		if (height%7300==0) {
			console.log("Reached end.");
			saveProgress(height);
			process.exit();
		}
		*/

		next_height = produceDbVoteInserts(height);
	}

	// Save the final state
	console.log("Reached end.");
	saveProgress(height);
}

function saveProgress(height, next_block_hash) {
	console.log("At height " + height + ". Saving state.");
	fs.writeFileSync(savefile, JSON.stringify({'height' : height}));
}

function produceDbVoteInserts(height) {
	// Collect the block
	var blocksubdir = "blocks_" + (Math.trunc(height/1000)*1000) + "_" + (Math.trunc(height/1000)*1000 + 999) + "/";
	var location = blockdir + blocksubdir + "block_" + height + ".json";

	// Validate that we have a file for this block
	if (!fs.existsSync(location)) {
		return null;
	}

	// Collect all transactions
	var block_json = fs.readFileSync(location);
	var block = JSON.parse(block_json);

	// Mark some memory up for GC
	block_json = null; delete block_json;

	// Prep for the inserts
	var db_inserts = '';

	// Only need to look at staking transactions
	for (var i = 0; i < block["rawstx"].length; i++) {
		// Get information about the transaction
		var tx = block["rawstx"][i];

		// Validate that these vins include a stakebase
		var b_has_stakebase = false;
		for (var j = 0; j < tx.vin.length; j++) {
			var vin = tx.vin[j];

			if (vin.hasOwnProperty('stakebase')) {
				b_has_stakebase = true;
				break;
			}
		}

		if (!b_has_stakebase) continue;

		// DETERMINED FROM dcrd SOURCE: func IsSSGen in staketx.go
		// FROM THE SOURCE ----
		// SSGen transactions are specified as below.
		// Inputs:
		// Stakebase null input [index 0]
		// SStx-tagged output [index 1]
		//
		// Outputs:
		// OP_RETURN push of 40 bytes containing: [index 0]
		//     i. 32-byte block header of block being voted on.
		//     ii. 8-byte int of this block's height.
		// OP_RETURN push of 2 bytes containing votebits [index 1]
		// SSGen-tagged output to address from SStx-tagged output's tx index output 1
		//     [index 2]
		// SSGen-tagged output to address from SStx-tagged output's tx index output 2
		//     [index 3]
		// ...
		// SSGen-tagged output to address from SStx-tagged output's tx index output
		//     MaxInputsPerSStx [index MaxOutputsPerSSgen - 1]
		//

		// Also from the source ---
		//func SSGenVoteBits(tx *wire.MsgTx) uint16 {
		//	return binary.LittleEndian.Uint16(tx.TxOut[1].PkScript[2:4])
		//}
		//func SSGenVersion(tx *wire.MsgTx) uint32 {
		//	if len(tx.TxOut[1].PkScript) < 8 {
		//		return VoteConsensusVersionAbsent
		//	}
		//	return binary.LittleEndian.Uint32(tx.TxOut[1].PkScript[4:8])
		//}

		// Get the voting information
		if (tx.vout.length < 3) {
			console.log("ERROR: Stakebase includes fewer than 3 outputs.");
			console.log("Currently on " + height);
			process.exit();
		}

		// Second vout is the vote
		var vout       = tx.vout[1];
		var vote_bits  = vout.scriptPubKey.hex.substring(4,6);
		var issue_bits = vout.scriptPubKey.hex.substring(6,10);

		db_inserts += 'INSERT INTO tx_vote ("tx_id", "hex", "votes", "version") ';
		db_inserts += 'SELECT tx.tx_id, \'' + vout.scriptPubKey.hex + '\',\'' + vote_bits + '\',\'' + issue_bits + '\' ';
		db_inserts += 'FROM tx WHERE tx.hash = \'' + tx.txid + '\' ORDER BY tx.tx_id DESC LIMIT 1;\r\n';
	}

	// Write the insert file
	var insert_location = './sql_data/import_votes.sql';
	fs.appendFileSync(insert_location, db_inserts);

	return (height + 1);

}
