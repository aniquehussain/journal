//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const app = express();
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

var loggedUser;
var direct;

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: 'Little secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const connectDB = () =>{
  
  try {
    const connected = mongoose.connect(`mongodb+srv://anique:${process.env.DBPASS}@cluster0.ypu7z.mongodb.net/journalDB?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    if (connected) {
      console.log("DB is connected");
    }
  } catch (err) {
    console.log("Could not connect");
    res.json(err);
  }
 

} 
connectDB();


mongoose.set('useCreateIndex', true);


const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  username: {
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const Post = mongoose.model('Post', postSchema);

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }
});
userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


// Register and login

app.post('/register', async (req, res) => {

  const { username, password } = req.body;
  const foundUser = await User.findOne({ username });

  try {
    if (!foundUser) {
      const register = await User.register({ name: req.body.name, username: req.body.username }, req.body.password);
      if (register) {
        passport.authenticate('local')(req, res, function (user) {
          res.redirect("/user/" + req.user._id);
        });
      }
    } else {
      console.log("User Already Registered");
      res.redirect('/');
    }
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

app.post('/login', function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  try {
    req.login(user, async function (err) {
      if (err) {
        console.log(err);
      } else {
        await passport.authenticate('local')(req, res, function () {
          res.redirect('/user/' + req.user._id);
        });
      }
    });
  } catch (err) {
    res.redirect('/');
  }

});
// -------------------------------------------------------------------------------------------------------------

app.get('/', async function (req, res) {
  if (req.isAuthenticated()) {

    const posts = await Post.find({}).sort({ date: 'desc' });
    try {
      res.render("home", {
        userId: loggedUser,
        posts: posts
      });
    } catch (err) {
      console.log(err);
    }

  } else {
    res.render('login');
  }
});


app.get('/logout', async function (req, res) {
  req.logout();
  res.redirect('/');
});

app.get("/user/:userId", async function (req, res) {
  const requestedUserId = req.params.userId;
  if (req.isAuthenticated()) {
    const foundUser = await User.findById(requestedUserId);
    const foundPost = await Post.find({ creator: requestedUserId });
    try {

      loggedUser = `/user/${req.user._id}`;
      res.render('user', { userId: loggedUser, user: foundUser.name, posts: foundPost });
    } catch (err) {
      console.log(err);
    }
  }
});

app.get("/posts/:postId", async function (req, res) {
  const requestedPostId = req.params.postId;
  if (req.isAuthenticated()) {

    const post = await Post.findById(requestedPostId);
    try {
      res.render("post", {
        creator: post.username,
        title: post.title,
        content: post.content,
        date: post.date,
        userId: loggedUser
      });
    } catch (err) {
      console.log(err);
    }
  } else {
    res.redirect('/');
  }

});



app.post("/compose", async function (req, res) {

  if (req.isAuthenticated()) {


    try {
      const post = new Post({
        title: req.body.postTitle,
        content: req.body.postBody,
        creator: req.user.id,
        username: req.user.name
      });
      const saved = await post.save();
      if (saved) {
        res.redirect("/");
      } else {
        console.log("Not saved");
      }
    } catch (err) {
      console.log(err);
    }

  }
});

app.post('/posts/:postId/delete', async (req, res) => {
  const requestedPostId = req.params.postId;
  console.log("Post id: " + requestedPostId);
  console.log("User id: " + req.user._id);

  if (req.isAuthenticated()) {

    Post.findByIdAndDelete(requestedPostId, (err) => {
      if (!err) {
        console.log("Post Deleted");
        res.redirect('/');
      } else {
        console.log(err);
      }
    })
  }
});

app.get('/about', async (req, res) => {
  res.render('about', { userId: loggedUser });
})

app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000");
});
