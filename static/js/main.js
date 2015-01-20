var ws = new WebSocket(location.href.replace('http', 'ws').replace('room', 'ws'));
var fps, audiosrc, imgsrc, depth;
var img, scene, camera, renderer, controls;
var texture, geometry, material, movieScreen;
var stop = false, first = true, id;
var width, height, widthSegment, heightSegment, depth = 255;

// WebSocket Code

ws.onopen = function(event) {
  console.log('WebSocket connection OPENED');
  newScene();
  get('fps'); 
  get('audio');
  
  id = setInterval(function() {
    if (!stop) {
      get('frame');
    } else {
      clearInterval(id);
    }
  }, fps / 1000);
};

ws.onmessage = function(msg) {
  var data = JSON.parse(msg.data);

  if (data.msg === 'fps') {
    fps = data.fps;
  } else if (data.msg === 'audio') {
    audiosrc = data.audio;

    var elem = $('audio')[0];
    elem.src = '/static/' + audiosrc;
    elem.load();
  } else if (data.msg === 'frame') {
    if (data.stop) {
      stop = true;
      return;
    }

    imgsrc = data.b64;
    depth = data.depth;

    if (first) {
      width = depth.length;
      height = depth[0].length;
      widthSegment = width / 4;
      heightSegment = height / 8;
    }

    img = new Image();
    img.src = 'data:image/png;base64,' + imgsrc;
    img.onload = newImage;
  } else {
    console.log('unknown message', msg);
  }
};

ws.onclose = function(event) {
  console.log('WebSocket connection CLOSED');
};

ws.onerror = function(err) { 
  console.log('WebSocket connection ERROR', err); 
};

function get(type) { 
  ws.send(JSON.stringify({ msg: type }));
}

// Three.js Code
// Some taken from: stemkoski.github.io/Three.js/Video.html

function newScene() {
  scene = new THREE.Scene();
  var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
  var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 0.1, FAR = 20000;
  camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
  scene.add(camera);
  
  camera.position.set(0,150,400);
  camera.lookAt(scene.position);  

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth - 100, window.innerHeight - 100);
  document.body.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  update();
}

function update() {
  requestAnimationFrame(update);
  controls.update();
  renderer.render(scene, camera);
}

function newImage() {
  if (!first) {
    scene.remove(movieScreen);
  }

  texture = new THREE.Texture(img);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  material = new THREE.MeshBasicMaterial({
    opacity: 1,
    map: texture,
    overdraw: true, 
    side: THREE.DoubleSide
  });
  material.needsUpdate = true;

  geometry = new THREE.PlaneGeometry(width, height, widthSegment, heightSegment);
  //geometry = new THREE.BoxGeometry(width, height, depth, widthSegment, heightSegment);
  geometry.dynamic = true;
  applyDepths();

  movieScreen = new THREE.Mesh(geometry, material);
  movieScreen.position.set(0,50,0);
  scene.add(movieScreen);
  
  camera.position.set(0,150, 500);
  camera.lookAt(movieScreen.position);

  //renderer.render(scene, camera);

  if (first) {
    $('audio')[0].play();
    first = false;
  }
}

function applyDepths() {
  for(var i = 0; i < widthSegment; i++) {
    for(var j = 0; j < heightSegment; j++) {
      geometry.vertices[i * heightSegment + j].z = depth[i][j];
    }
  }

  for (var i = 1; i < widthSegment ; i++) {
    for (var j = 1; j < heightSegment ; j++) {
      geometry.vertices[i * heightSegment + j].z = (
        geometry.vertices[i * heightSegment + j].z + 
        geometry.vertices[(i - 1) * heightSegment + j].z + 
        geometry.vertices[(i + 1) * heightSegment + j].z + 
        geometry.vertices[i * heightSegment + i - j].z + 
        geometry.vertices[i * heightSegment + i + j].z) / 5;
    }
  }

  geometry.verticesNeedUpdate = true;
}