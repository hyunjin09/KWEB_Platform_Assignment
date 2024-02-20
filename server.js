const express = require('express')
const app = express()
const {MongoClient, ObjectId} = require('mongodb')
require('dotenv').config()
// const methodOverride = require('method-override'); 
// app.use(methodOverride('_method'));
// app.set('view engine', 'ejs')
app.use(express.json());
app.use(express.urlencoded({extended:true}));

//#region 회원기능
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')
app.use(passport.initialize())
app.use(session({
  secret: process.env.SECRET,
  resave : false,
  saveUninitialized : false,
  cookie : {maxAge : 60 * 60 * 1000},
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : 'forum'
  })
}))

app.use(passport.session())

var cors = require('cors')
app.use(cors());

const bcrypt = require('bcrypt') 

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => { 
    let result = await db.collection('user').findOne({ username : 입력한아이디})
    if (!result) {
      return cb(null, false, { message: '아이디 DB에 없음' }) 
    }

    if (await bcrypt.compare(입력한비번, result.password)) { 
      return cb(null, result)
    } else {
      return cb(null, false, { message: '비번불일치' });
    }
  }))

  passport.serializeUser((user, done) => {
    process.nextTick(() => { 
      done(null, { id: user._id, username: user.username })
    })
  })

  passport.deserializeUser(async (user, done) => { 
    let result = await db.collection('user').findOne({_id : new ObjectId(user.id)})
    delete result.password 
    process.nextTick(() => { 
      return done(null, result)
    })
  })

  app.get('/login', async (req, res) => {
    res.render('login.ejs')
  })

  app.post('/login', async (req, res, next) => {
    passport.authenticate('local', (error, user, info) => { 
      if(error) return res.status(500).json(error) 
      if(!user) return res.status(401).json(info.message)
      req.logIn(user, (err) => { 
        if(err) return next(err)
        res.redirect('/') 
      })
    })(req, res, next) 
  
  })

  app.get('/register', (req, res) => {
    res.render('register.ejs')
  })

  app.post('/register', async (req, res) => {
    console.log(req.body)
    let count = await db.collection('user').find({username : req.body.username}).count();
    if(count > 0){
      return res.send("중복 아이디");
    }
    if(req.body.password != req.body.password2) return res.send("비번 일치하지 않습니다");

    let hash = await bcrypt.hash(req.body.password, 10)

    await db.collection('user').insertOne({username : req.body.username, password : hash, occupation : req.body.occupation}) //악성유저는 맘대로 <input>여러개 만들 수 있어서 req 꺼내서 DB에 넣기
    res.redirect('/')
  })

  function checkLogin(req, res, next){ 
    if(req.user){
      next()
    } else {
      res.send('로그인 먼저 하세요')
    }
  }
//#endregion

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
})

const dbURL = process.env.DB_URL
let db
let connectDB = new MongoClient(dbURL).connect()
connectDB.then((client)=>{
    console.log("DB 연결")
    db = client.db('forum')
    app.listen(process.env.port, () => {
        console.log('서버 실행중')
    })
}).catch((err)=>{
    console.log(err)
})