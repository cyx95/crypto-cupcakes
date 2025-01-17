require("dotenv").config(".env");
const cors = require("cors");
const express = require("express");
const app = express();
const morgan = require("morgan");
const { PORT = 3000 } = process.env;
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env;
// TODO - require express-openid-connect and destructure auth from it
const { auth } = require("express-openid-connect");

const { User, Cupcake } = require("./db");

// middleware
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* *********** YOUR CODE HERE *********** */
// follow the module instructions: destructure config environment variables from process.env
// follow the docs:
const { AUTH0_SECRET, AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_BASE_URL } =
  process.env;

// define the config object
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: AUTH0_SECRET,
  baseURL: AUTH0_AUDIENCE,
  clientID: AUTH0_CLIENT_ID,
  issuerBaseURL: AUTH0_BASE_URL,
};

// attach Auth0 OIDC auth router
app.use(auth(config));

// Authorization middleware
app.use(async (req, res, next) => {
  try {
    const auth = req.header("Authorization");
    if (!auth) {
      next();
    } else {
      const [, token] = auth.split(" ");
      const user = jwt.verify(token, JWT_SECRET);
      req.user = user;
      next();
    }
  } catch ({ message }) {
    res.sendStatus(401);
    next({ message });
  }
});

// middleware to save user information to the database
app.use(async (req, res, next) => {
  try {
    const [user] = await User.findOrCreate({
      where: {
        username: `${req.oidc.user.nickname}`,
        name: `${req.oidc.user.name}`,
        email: `${req.oidc.user.email}`
      },
    });
    console.log(user);
    next();
  } catch (error) {
    console.error(error);
  }
});

// create a GET / route handler that sends back Logged in or Logged out
app.get("/", (req, res) => {
  res.send(
    req.oidc.isAuthenticated()
      ? `<html>
        <head>
        </head>
        <body>
          <h1 style="text-align: center;"> My Web App,Inc.</h1>
          <h1>Welcome, ${req.oidc.user.name}</h1>
          <p><b>Username: ${req.oidc.user.nickname}</b></p>
          <p>${req.oidc.user.email}</p>
          <img src=${req.oidc.user.picture}>
        </body>
      </html>`
      : "Logged out"
  );
});

app.get("/cupcakes", async (req, res, next) => {
  try {
    const cupcakes = await Cupcake.findAll();
    res.send(cupcakes);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.get("/me", async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: {
        username: req.oidc.user.nickname,
      },
      raw: true,
    });
    if (user) {
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "1w" });
      res.send({ user, token });
    } else {
      res.status(401).send("User does not exist");
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
});

app.post("/cupcakes", async (req, res, next) => {
  try {
    if (!req.user) {
      res.sendStatus(401);
    } else {
      const userId = req.user.id;
      const { title, flavor, stars } = req.body;
      const cupcake = await Cupcake.create({ title, flavor, stars, userId });
      res.send({
        id: cupcake.id,
        title: cupcake.title,
        flavor: cupcake.flavor,
        stars: cupcake.stars,
      });
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// error handling middleware
app.use((error, req, res, next) => {
  console.error("SERVER ERROR: ", error);
  if (res.statusCode < 400) res.status(500);
  res.send({ error: error.message, name: error.name, message: error.message });
});

app.listen(PORT, () => {
  console.log(`Cupcakes are ready at http://localhost:${PORT}`);
});
