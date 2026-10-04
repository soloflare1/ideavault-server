
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config(); 

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://ideavault-c32dd.firebaseapp.com",  
      "https://ideavault-c32dd.web.app",
      "https://idea-vault-client-drab.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access - Token Missing" });
  } 

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access - Invalid Token" });
    }
    req.user = decoded;
    next();
  });
};

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("ideaVaultDB");
    const ideasCollection = db.collection("ideas");
    const commentsCollection = db.collection("comments");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "365d",
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      }).send({ success: true, token });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token", {
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      }).send({ success: true });
    });

    app.get("/ideas", async (req, res) => {
      const { search, category, limit } = req.query;
      let query = {};
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }
      if (category && category !== "All Categories") {
        query.category = category;
      }

      let cursor = ideasCollection.find(query).sort({ createdAt: -1 });
      if (limit) {
        cursor = cursor.limit(parseInt(limit));
      }
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/ideas/:id", async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid Mongo ID" });
      } 

      const result = await ideasCollection.findOne({ _id: new ObjectId(id) });
      if (!result) {
        return res.status(404).send({ message: "Idea not found" });
      }
      res.send(result);
    } );

    app.get("/my-ideas", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (req.user.email !== email) {
        return res.status(403).send({ message: "Forbidden Access" });
      } 

      const result = await ideasCollection.find({ authorEmail: email }).toArray();
      res.send(result);
    } );

    app.post("/ideas", verifyToken, async (req, res) => {
      const newIdea = {
        ...req.body,  
        upvotesCount: 0,
        upvotedBy: [],
        createdAt: new Date().toISOString(),
      };
      const result = await ideasCollection.insertOne(newIdea);
      res.send(result);
    } );

    app.put("/ideas/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateData = { ...req.body };
      delete updateData._id;

      const updatedDoc = {
        $set: updateData,
      };
      const result = await ideasCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
 
    app.delete("/ideas/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ideasCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/ideas/:id/upvote", verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.user.email;
      const idea = await ideasCollection.findOne({ _id: new ObjectId(id) });

      if (!idea) {
        return res.status(404).send({ message: "Idea not found" });
      }


      let updateDoc;
      let isUpvoted = false;


      if (idea.upvotedBy?.includes(email)) {
        updateDoc = {
          $pull: { upvotedBy: email },
          $inc: { upvotesCount: -1 },
        };
      } else {
        updateDoc = {
          $addToSet: { upvotedBy: email },
          $inc: { upvotesCount: 1 },
        };
        isUpvoted = true;
      } 

      await ideasCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
      res.send({ isUpvoted });
    });

    app.get("/comments/:ideaId", async (req, res) => {
      const ideaId = req.params.ideaId;
      const result = await commentsCollection
        .find({ ideaId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/comments", verifyToken, async (req, res) => {
      const newComment = {
        ...req.body,  
        createdAt: new Date().toISOString(),
      };
      const result = await commentsCollection.insertOne(newComment);
      res.send(result);
    });

    const handleCommentUpdate = async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid comment ID" });
      }

      const filter = { _id: new ObjectId(id) }; 
      const updateData = { ...req.body };
      delete updateData._id;

      const updatedDoc = {
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await commentsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    };

    app.patch("/comments/:id", verifyToken, handleCommentUpdate); 
    app.put("/comments/:id", verifyToken, handleCommentUpdate);

    app.delete("/comments/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await commentsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    const handleInteractions = async (req, res) => {
      const email = req.query.email || req.user.email;

      try {
        const userComments = await commentsCollection
          .find({
            $or: [
              { userEmail: email },
              { email: email },
              { authorEmail: email },
            ],
          })
          .toArray();

          const commentedIdeaIds = [
            ...new Set(userComments.map((comment) => comment.ideaId)),
          ]
            .filter((id) => id && ObjectId.isValid(id))
            .map((id) => new ObjectId(id));

            const commentedIdeas = await ideasCollection
              .find({ _id: { $in: commentedIdeaIds } })
              .toArray();

            const upvotedIdeas = await ideasCollection
              .find({ upvotedBy: email })
              .toArray();

              res.send({
                commentedIdeas,
                upvotedIdeas,
                userComments,
              });
            } catch (err) {
              res.status(500).send({ message: "Failed to load interactions" });
            } 
         };
            
         app.get("/my-interactions", verifyToken, handleInteractions);
         app.get("/my-activity", verifyToken, handleInteractions);

         console.log("MongoDB Database connected successfully!");
        }
         finally {
         }
    }

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("IdeaVault Server is running smoothly!");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});