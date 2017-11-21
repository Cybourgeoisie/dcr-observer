db.block.aggregate([
    { $unwind: '$tx' },
    { $group: { _id: null, tags: {"$addToSet": "$tx.hash" } } }
])

db.block.find({ },{ hash: 1 })
db.block.find({ },{ tx: 1 })

db.getCollection('products').aggregate([
    {
        $unwind: '$features'
    },
    {
        $group: {
            _id: "$features.values.name",
            values: {$addToSet: '$features.values.values'}
        },
    }
])

// fucking finally. print out the hashes
db.block.find({hash:"000000000001df23539f3ca1c9b6d10aed646b7d7f0d3ef6a48b3637232bb753"}, {tx: 1}).forEach(function(txes) { for(var i = 0; i<txes.tx.length; i++) { print(txes.tx[i].hash) } })
db.block.find({}, {tx: 1}).forEach(function(txes) { for(var i = 0; i<txes.tx.length; i++) { print(txes.tx[i].hash) } })

// print out addresses
db.block.find({}, {tx: 1}).forEach(function(txes) { for(var i = 0; i<txes.tx.length; i++) { for(var j=0;j<txes.tx[i].vout.length;j++) { for(var k=0;k<txes.tx[i].vout[j].addresses.length;k++) { print(txes.tx[i].vout[j].addresses[k]); } } } })
