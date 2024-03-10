const express = require('express')
const app = express()
const {MongoClient, ObjectId} = require('mongodb')
require('dotenv').config()
const methodOverride = require('method-override'); 
app.use(methodOverride('_method'));
app.set('view engine', 'ejs')
app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(express.static(__dirname + '/public'));

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

  app.get('/logout', (req, res, next) => {
    req.logout((err) => {
      if(err) {return next(err)}
      res.redirect('/')
    })
  })

  app.get('/register', (req, res) => {
    res.render('register.ejs')
  })

  app.post('/register', async (req, res) => {
    let count = await db.collection('user').find({username : req.body.username}).count();
    if(count > 0){
      return res.send("중복 아이디");
    }
    if(req.body.password != req.body.password2) return res.send("비번 일치하지 않습니다");

    let hash = await bcrypt.hash(req.body.password, 10)

    await db.collection('user').insertOne({username : req.body.username, password : hash, occupation : req.body.occupation})
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

app.get('/', (req, res) => {
  if(req.user){
    res.redirect('/list')
  }
  else res.sendFile(__dirname + '/index.html')
})

app.get('/list', checkLogin, async (req, res) => {
  let result = await db.collection('post').find().toArray();
  res.render('list.ejs', {posts : result, user : req.user.occupation})
})

app.get('/detail/:id', checkLogin, async (req, res) => {
try{
  let result = await db.collection('post').findOne({ _id : new ObjectId(req.params.id)}); 
  let richTexts = result.posts
  if(result == null){
    res.status(404).send('이상한 url 입력함')
  }
  res.render('detail.ejs', {result : result, richTexts : richTexts, user : req.user.occupation}); 
} catch(e){
  console.log(e);
  res.status(404).send('이상한 url 입력함')
}
}) 

app.get('/enroll/:id', async (req, res) => {
  if(req.user.occupation == 'student'){

    let result = await db.collection('post').findOne({$and : [
      {'students._id' : new ObjectId(req.user._id)},
      {_id : new ObjectId(req.params.id)}
    ]})

    if(result == null){
      await db.collection('post').updateOne({_id : new ObjectId(req.params.id)}, 
      {$push : {students : req.user}})
      res.redirect('/list')
    }
    else{
      res.send('이미 신청하셨습니다')
    }

  } else{
    res.send('학생만 신청할 수 있습니다')
  }

})

app.get('/myclasses', checkLogin, async (req, res) => {
  let result = null
  if(req.user.occupation == 'student'){
    result = await db.collection('post').find(
      {'students._id' : new ObjectId(req.user._id)}
    ).toArray()
  }
  else{
    result = await db.collection('post').find(
      {'user' : new ObjectId(req.user._id)}
    ).toArray()
  }
  res.render('myclasses.ejs', {posts : result, user : req.user.occupation})
})

app.get('/myclasses-posts', checkLogin, async (req, res) =>{
  let result = null
  if(req.user.occupation == 'student'){
    result = await db.collection('post').find(
      {'students._id' : new ObjectId(req.user._id)}
    ).toArray()
  }
  else{
    result = await db.collection('post').find(
      {'user' : new ObjectId(req.user._id)}
    ).toArray()
  }
  let posts = []
  let times = []
  for(i=0; i<result.length; i++){
    if(result[i].posts) posts = posts.concat(result[i].posts)
    if(result[i].time) times = times.concat(result[i].time)
  }

  let decor = (v, i) => [v, i];          
  let undecor = a => a[1];               
  let argsort = arr => arr.map(decor).sort().map(undecor);
  order = argsort(times)
  postSorted = (order.map(i => posts[i])).reverse()

  res.render('myclassesPosts.ejs', {richTexts : postSorted, user : req.user.occupation})

})

app.get('/create-class', checkLogin, async (req, res) => {
  if(req.user.occupation == 'student'){
    res.send('교수만 강의를 생성할 수 있습니다')
  }
  else res.render('createClass.ejs', {user : req.user.occupation})
})

app.post('/create-class', async (req, res) => {
  if(req.body.title == ''){
    res.send('강의 제목을 입력해주세요')
  } else{
    await db.collection('post').insertOne( 
          {
            title : req.body.title, 
            content : req.body.content, 
            user : req.user._id,
            username : req.user.username 
          })
    res.redirect('/list')
  }
})

app.get('/post/:id', checkLogin, async (req, res) => {
  if(req.user.occupation == 'student'){
    res.send('교수만 게시물을 생성할 수 있습니다')
  } else{
    let result = await db.collection('post').findOne({_id : new ObjectId(req.params.id)})
    if(req.user._id.toString() == result.user.toString()) res.render('createPost.ejs', {result : result})
    else res.send('내가 만든 강의가 아닙니다')
  }


})

app.post('/create-post', async (req, res) => {
  await db.collection('post').updateOne({_id : new ObjectId(req.body.id)},
    {$push : {posts : req.body.htmlContent, time : Date.now()}}
  )
})

app.get('/check-students/:id', checkLogin, async (req, res) => {
  if(req.user.occupation == 'student'){
    res.send('교수가 아닙니다')
  }
  else{
    result = await db.collection('post').findOne({_id : new ObjectId(req.params.id)})
    if(result.students == null || result.students.length == 0) res.send('수강중인 학생이 없습니다')
    else res.render('manageStudents.ejs', result)
  }

})

app.get('/cancel/:classid/:studentid', checkLogin, async (req, res) => {
  if(req.user.occupation == 'student'){
    res.send('교수가 아닙니다')
  }
  else{
    await db.collection('post').findOneAndUpdate(
      {_id : new ObjectId(req.params.classid)},
      {$pull : {students : {_id : new ObjectId(req.params.studentid)}}}
    )
    res.redirect(`/check-students/${req.params.classid}`)
  }
})

const dbURL = process.env.DB_URL
let db
let connectDB = new MongoClient(dbURL).connect()
connectDB.then((client)=>{
    console.log("DB 연결")
    db = client.db('forum')
    app.listen(process.env.PORT, () => {
        console.log('서버 실행중')
    })
}).catch((err)=>{
    console.log(err)
})