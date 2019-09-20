const { Client } = require('pg')
const Caver = require('caver-js')
require('dotenv').config()

const caver = new Caver(process.env.RPC_API_URL)
const client = new Client({
    connectionString: process.env.DB_URL,
})
client.connect()

const query = {
    text: 'SELECT * FROM launch_logs where status = $1',
    values: ['created'],
    rowMode: 'array',
    order: 'created_at asc',
    rowCount: 100
}

sendTx = async (txData) => {

    try {
        const signedTransaction = await caver.klay.accounts.signTransaction(txData, process.env.PRIVATE_KEY);
        await caver.klay.sendSignedTransaction(signedTransaction.rawTransaction)
            .on('transactionHash', function (txhash) {
                txData.transaction_hash = txHash
                updateLaunchLog(txData)
            })
            .on('receipt', function (receipt) {
                console.log('receipt later', receipt);
            })
            .on('error', function (err) {
                console.error('something went wrong');
            });
    } catch (e) {
        console.error(e)
    }

}

const prepareTxdata = (log) => {
    caver.klay.getTransactionCount(process.env.FROM_ADDR).then(nonce => {
        // construct the transaction data
        const txData = {
            nonce: nonce,
            gasLimit: '3000000000',
            gasPrice: '25000000000',
            to: process.env.CONTRACT_ADDRESS,
            from: process.env.FROM_ADDR,
            value: 0,
            data: log.data
        }
        // fire away!
        sendTx(txData)
    })
}

const fetchLogs = () => {
    let logs = [];
    client.query(query, (err, res) => {
        for (let i = 0; i < res.rows.length; i++) {
            let log = {};
            for (let j = 0; j < res.fields.length; j++) {
                log[res.fields[j].name] = res.rows[i][j];
            }
            prepareTxdata(log)
            //logs.push(log)
        }
        //console.log(logs)
    })
}

const updateLaunchLog = (log) => {
    client.query('UPDATE launch_logs SET transaction_hash=($1), WHERE id=($2)', [log.transaction_hash, log.id]);

}

const interval = setInterval(function () {
    fetchLogs();
}, 5000)