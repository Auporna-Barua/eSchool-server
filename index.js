const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000

// middleware
app.use(cors());
app.use(express.json());


// jwt middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decode) => {
    if (error) {
      return res.status(403).send({ error: true, message: 'unauthorized access' })
    }
    req.decode = decode;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_ID}:${process.env.DB_PASS}@cluster0.ovwjs.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // Collection'ss
    const userCollection = client.db("the-music-mystery").collection("users")
    // get all existing user's from database
    app.get('/allUsers', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })
    // post newUser in database
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(user);
      res.send(result)
    })
    // make admin user
    app.patch('/allUsers/admin/:id', async (req, res) => {
      const id = req.params;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // make Musician user
    app.patch('/allUsers/musician/:id', async (req, res) => {
      const id = req.params;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'musician'
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // connecting api's
    app.get('/', (req, res) => {
      res.send('Hello World!')
    })

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`)
    })
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);
