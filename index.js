const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
const stripe = require("stripe")("sk_test_51Msq0jSHKrITcj7CtK2RsqHHhdQEx1yWHGLd5FRpFvIJKzynVOUWfXKXpzAql6OyO1jR6mR0CueZpXgXpu8UYQVB00q6KbNB7P");

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
    const userCollection = client.db("eSchool").collection("users");
    const classCollection = client.db("eSchool").collection("classes");
    const selectedCollection = client.db("eSchool").collection("selectedClass");
    const paymentCollection = client.db("eSchool").collection("payments");
    const enrolledCollection = client.db("eSchool").collection("enrolled");
    // use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const order = req.body;
      console.log(order);
      const price = order.price;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
        description: 'music school educational institute',
        shipping: {
          name: "Apurna Barua",
          address: {
            line1: "Cox's bazar",
            postal_code: "4700",
            city: "Cox's bazar",
            state: "BD",
            country: "Bangladesh",
          },
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    // create JWT token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' })
      res.send({ token })
    })

    // get all existing user's from database
    app.get('/allUsers', verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })
    // get all existing user's from database
    app.get('/instructors', async (req, res) => {
      const result = await userCollection.find({ role: "musician" }).toArray();
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
    app.delete("/user/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const usersData = await userCollection.deleteOne(quary);
      res.send(usersData);
    });

    // make admin user
    app.patch('/allUsers/admin/:id', verifyJWT, async (req, res) => {
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
    app.get('/allUsers/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      res.send(user)

    })
    // make Musician user
    app.patch('/allUsers/musician/:id', verifyJWT, async (req, res) => {
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
    // course related api

    app.post('/addClass', verifyJWT, async (req, res) => {
      const classData = req.body;
      const result = await classCollection.insertOne(classData);
      res.send(result)
    })

    app.get('/myClasses/:email', verifyJWT, async (req, res) => {
      console.log("params", req.decode);
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (!user) {
        res.json({ message: "user is not exits" });
      }
      const classes = await classCollection.find({ email }).toArray();
      res.json(classes)
    })
    app.get('/allClasses', verifyJWT, async (req, res) => {
      const classes = await classCollection.find({}).toArray();
      res.json(classes)
    })
    app.get('/approveClasses', async (req, res) => {
      const data = await classCollection.find({ status: "approved" }).sort({ seats: 1 }).toArray();
      res.json(data)
    })
    //class approved
    app.patch('/manageClass/approved/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    //class deny
    app.patch('/manageClass/deny/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    //class deny
    app.put('/manageClass/feedback/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const feedback = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          feedBack: feedback.message
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })


    app.get('/editClass/:id', async (req, res) => {
      const id = req.params.id;
      const result = await classCollection.findOne({ _id: new ObjectId(id) });
      res.send(result)

    })

    app.put('/editClass/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updateDoc = {
        $set: data,
      };

      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    })


    // selected class area start

    app.get('/selectedClasses/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const classes = await selectedCollection.find({ user: email }).toArray();
      res.json(classes)
    })
    app.get('/singleClass/:id', async (req, res) => {
      const id = req.params.id;
      const classes = await selectedCollection.findOne({ _id: new ObjectId(id) });
      res.json(classes)
    })

    // post selected item in database
    app.post('/selectedClass/:email', async (req, res) => {
      const classes = req.body;
      const email = req.params.email;
      const data = { name: classes.name, user: email, id: classes._id, photo: classes.photo, price: classes.price, seats: classes.seats, status: classes.status, instructor: classes.instructor, email: classes.email };
      const result = await selectedCollection.insertOne(data);
      res.send(result)
    })
    app.delete("/selectedClass/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(quary);
      console.log(result);
      res.send(result);
    });

    // payment method
    //Patch
    app.patch('/classOrder/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };

      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const enrolledClass = await enrolledCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc)
    })

    // payment related api
    app.post('/enroll/paid/:id', verifyJWT, async (req, res) => {
      const payment = req.body;
      const id = req.params.id;
      const insertResult = await paymentCollection.insertOne(payment);
      const query = { _id: new ObjectId(id) };
      const deleteResult = await selectedCollection.deleteOne(query);
      const insertEnroll = await enrolledCollection.insertOne(payment);

      res.send({ insertResult, deleteResult, insertEnroll });
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
    // await client.close();
  }
}
run().catch(console.dir);
