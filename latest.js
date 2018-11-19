/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://wma8.github.io/prog4/triangles.json"; // triangles file loc
const INPUT_IMAGE_PREFIX = "https://wma8.github.io/prog4/"; //  image prefix.
const INPUT_IMAGE_TEST = "https://wma8.github.io/prog4/test.json";
var defaultEye = vec3.fromValues(0.5, 0.5, -0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5, 0.5, 0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0, 1, 0); // default view up vector
var lightAmbient = vec3.fromValues(1, 1, 1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1, 1, 1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1, 1, 1); // default light specular emission
var lightPosition = vec3.fromValues(-1, 3, -0.5); // default light position
var rotateTheta = Math.PI / 50; // how much to rotate models by with each key press
var Blinn_Phong = true;
var samplerImage;
/* webgl and geometry data */
var gl = null; // the all powerful gl object. It's all here folks!
var inputTriangles = []; // the triangle data as loaded from input files
var numTriangleSets = 0; // how many triangle sets in input scene
var inputEllipsoids = []; // the ellipsoid data as loaded from input files
var numEllipsoids = 0; // how many ellipsoids in the input scene
var vertexBuffers = []; // this contains vertex coordinate lists by set, in triples
var normalBuffers = []; // this contains normal component lists by set, in triples
var uvsBuffers = []; // this contains uvs component lists by set, in triples
var triSetSizes = []; // this contains the size of each triangle set
var triangleBuffers = []; // lists of indices into vertexBuffers by set, in triples
var viewDelta = 0; // how much to displace view with each key press

/* shader parameter locations */
var vPosAttribLoc; // where to put position for vertex shader
var uvsAttribLoc; // where to put the uvs for fragment shader
var mMatrixULoc; // where to put model matrix for vertex shader
var pvmMatrixULoc; // where to put project model view matrix for vertex shader
var ambientULoc; // where to put ambient reflecivity for fragment shader
var diffuseULoc; // where to put diffuse reflecivity for fragment shader
var specularULoc; // where to put specular reflecivity for fragment shader
var shininessULoc; // where to put specular exponent for fragment shader
var alphaULOC; // where to put alpha reflectivity for fragment shader
var Blinn_PhongULoc;
/* interaction variables */
var Eye = vec3.clone(defaultEye); // eye position in world space
var Center = vec3.clone(defaultCenter); // view direction in world space
var Up = vec3.clone(defaultUp); // view up vector in world space

var nVertexBuffers = [];
var nNormalBuffers = [];
var nUvsBuffers = [];
var nTriangleBuffers = [];

var Switch = false;
var SwitchLoc;
// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
  try {
    if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
      throw "getJSONFile: parameter not a string";
    else {
      var httpReq = new XMLHttpRequest(); // a new http request
      httpReq.open("GET", url, false); // init the request
      httpReq.send(null); // send the request
      var startTime = Date.now();
      while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
        if ((Date.now() - startTime) > 3000)
          break;
      } // until its loaded or we time out after three seconds
      if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
        throw "Unable to open " + descr + " file!";
      else
        return JSON.parse(httpReq.response);
    } // end if good params
  } // end try
  catch (e) {
    console.log(e);
    return (String.null);
  }
} // end get input json file

function requestCORSIfNotSameOrigin(img, url) {
  if ((new URL(url)).origin !== window.location.origin) {
    img.crossOrigin = "";
  }
}

//  load the image retrive from MDN web docs
function loadTexture(url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Because images have to be download over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]); 
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  pixel);

    var image = new Image();
    
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                      srcFormat, srcType, image);

        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {            
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    requestCORSIfNotSameOrigin(image, url);
    image.src = url;

    return texture;
}
//retrive from MDN web docs
function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

// does stuff when keys are pressed
function handleKeyDown(event) {

  const modelEnum = {
    TRIANGLES: "triangles",
    ELLIPSOID: "ellipsoid"
  }; // enumerated model type
  const dirEnum = {
    NEGATIVE: -1,
    POSITIVE: 1
  }; // enumerated rotation direction

  function highlightModel(modelType, whichModel) {
    if (handleKeyDown.modelOn != null)
      handleKeyDown.modelOn.on = false;
    handleKeyDown.whichOn = whichModel;
    if (modelType == modelEnum.TRIANGLES)
      handleKeyDown.modelOn = inputTriangles[whichModel];
    else
      handleKeyDown.modelOn = inputEllipsoids[whichModel];
    handleKeyDown.modelOn.on = true;
  } // end highlight model

  function translateModel(offset) {
    if (handleKeyDown.modelOn != null)
      vec3.add(handleKeyDown.modelOn.translation, handleKeyDown.modelOn.translation, offset);
  } // end translate model

  function rotateModel(axis, direction) {
    if (handleKeyDown.modelOn != null) {
      var newRotation = mat4.create();

      mat4.fromRotation(newRotation, direction * rotateTheta, axis); // get a rotation matrix around passed axis
      vec3.transformMat4(handleKeyDown.modelOn.xAxis, handleKeyDown.modelOn.xAxis, newRotation); // rotate model x axis tip
      vec3.transformMat4(handleKeyDown.modelOn.yAxis, handleKeyDown.modelOn.yAxis, newRotation); // rotate model y axis tip
    } // end if there is a highlighted model
  } // end rotate model

  // set up needed view params
  var lookAt = vec3.create(),
    viewRight = vec3.create(),
    temp = vec3.create(); // lookat, right & temp vectors
  lookAt = vec3.normalize(lookAt, vec3.subtract(temp, Center, Eye)); // get lookat vector
  viewRight = vec3.normalize(viewRight, vec3.cross(temp, lookAt, Up)); // get view right vector

  // highlight static variables
  handleKeyDown.whichOn = handleKeyDown.whichOn == undefined ? -1 : handleKeyDown.whichOn; // nothing selected initially
  handleKeyDown.modelOn = handleKeyDown.modelOn == undefined ? null : handleKeyDown.modelOn; // nothing selected initially

  switch (event.code) {

    // model selection
    case "Space":
      if (handleKeyDown.modelOn != null)
        handleKeyDown.modelOn.on = false; // turn off highlighted model
      handleKeyDown.modelOn = null; // no highlighted model
      handleKeyDown.whichOn = -1; // nothing highlighted
      break;
    case "ArrowRight": // select next triangle set
      highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn + 1) % numTriangleSets);
      break;
    case "ArrowLeft": // select previous triangle set
      highlightModel(modelEnum.TRIANGLES, (handleKeyDown.whichOn > 0) ? handleKeyDown.whichOn - 1 : numTriangleSets - 1);
      break;


      // view change
    case "KeyA": // translate view left, rotate left with shift
      Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, viewDelta));
      if (!event.getModifierState("Shift"))
        Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, viewDelta));
      break;
    case "KeyD": // translate view right, rotate right with shift
      Center = vec3.add(Center, Center, vec3.scale(temp, viewRight, -viewDelta));
      if (!event.getModifierState("Shift"))
        Eye = vec3.add(Eye, Eye, vec3.scale(temp, viewRight, -viewDelta));
      break;
    case "KeyS": // translate view backward, rotate up with shift
      if (event.getModifierState("Shift")) {
        Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
        Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
      } else {
        Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, -viewDelta));
        Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, -viewDelta));
      } // end if shift not pressed
      break;
    case "KeyW": // translate view forward, rotate down with shift
      if (event.getModifierState("Shift")) {
        Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
        Up = vec3.cross(Up, viewRight, vec3.subtract(lookAt, Center, Eye)); /* global side effect */
      } else {
        Eye = vec3.add(Eye, Eye, vec3.scale(temp, lookAt, viewDelta));
        Center = vec3.add(Center, Center, vec3.scale(temp, lookAt, viewDelta));
      } // end if shift not pressed
      break;
    case "KeyQ": // translate view up, rotate counterclockwise with shift
      if (event.getModifierState("Shift"))
        Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, -viewDelta)));
      else {
        Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, viewDelta));
        Center = vec3.add(Center, Center, vec3.scale(temp, Up, viewDelta));
      } // end if shift not pressed
      break;
    case "KeyE": // translate view down, rotate clockwise with shift
      if (event.getModifierState("Shift"))
        Up = vec3.normalize(Up, vec3.add(Up, Up, vec3.scale(temp, viewRight, viewDelta)));
      else {
        Eye = vec3.add(Eye, Eye, vec3.scale(temp, Up, -viewDelta));
        Center = vec3.add(Center, Center, vec3.scale(temp, Up, -viewDelta));
      } // end if shift not pressed
      break;
    case "Escape": // reset view to default
      Eye = vec3.copy(Eye, defaultEye);
      Center = vec3.copy(Center, defaultCenter);
      Up = vec3.copy(Up, defaultUp);
      break;

      // model transformation
    case "KeyK": // translate left, rotate left with shift
      if (event.getModifierState("Shift"))
        rotateModel(Up, dirEnum.NEGATIVE);
      else
        translateModel(vec3.scale(temp, viewRight, viewDelta));
      break;
    case "Semicolon": // translate right, rotate right with shift
      if (event.getModifierState("Shift"))
        rotateModel(Up, dirEnum.POSITIVE);
      else
        translateModel(vec3.scale(temp, viewRight, -viewDelta));
      break;
    case "KeyL": // translate backward, rotate up with shift
      if (event.getModifierState("Shift"))
        rotateModel(viewRight, dirEnum.POSITIVE);
      else
        translateModel(vec3.scale(temp, lookAt, -viewDelta));
      break;
    case "KeyO": // translate forward, rotate down with shift
      if (event.getModifierState("Shift"))
        rotateModel(viewRight, dirEnum.NEGATIVE);
      else
        translateModel(vec3.scale(temp, lookAt, viewDelta));
      break;
    case "KeyI": // translate up, rotate counterclockwise with shift
      if (event.getModifierState("Shift"))
        rotateModel(lookAt, dirEnum.POSITIVE);
      else
        translateModel(vec3.scale(temp, Up, viewDelta));
      break;
    case "KeyP": // translate down, rotate clockwise with shift
      if (event.getModifierState("Shift"))
        rotateModel(lookAt, dirEnum.NEGATIVE);
      else
        translateModel(vec3.scale(temp, Up, -viewDelta));
      break;
    case "KeyB":
        if (Switch == true)
          Switch = false;
        else
          Switch = true;
      break;
    case "KeyN":
      handleKeyDown.modelOn.material.n = (handleKeyDown.modelOn.material.n + 1) % 20;
      console.log(handleKeyDown.modelOn.material.n);
      break;
    case "Numpad1":
      vec3.add(handleKeyDown.modelOn.material.ambient, handleKeyDown.modelOn.material.ambient, vec3.fromValues(0.1, 0.1, 0.1));
      if (handleKeyDown.modelOn.material.ambient[0] > 1.0)
        handleKeyDown.modelOn.material.ambient[0] = 0;
      if (handleKeyDown.modelOn.material.ambient[1] > 1.0)
        handleKeyDown.modelOn.material.ambient[1] = 0;
      if (handleKeyDown.modelOn.material.ambient[2] > 1.0)
        handleKeyDown.modelOn.material.ambient[2] = 0;
      console.log(handleKeyDown.modelOn.material.ambient);
      break;
    case "Numpad2":
      vec3.add(handleKeyDown.modelOn.material.diffuse, handleKeyDown.modelOn.material.diffuse, vec3.fromValues(0.1, 0.1, 0.1));
      if (handleKeyDown.modelOn.material.diffuse[0] > 1.0)
        handleKeyDown.modelOn.material.diffuse[0] = 0;
      if (handleKeyDown.modelOn.material.diffuse[1] > 1.0)
        handleKeyDown.modelOn.material.diffuse[1] = 0;
      if (handleKeyDown.modelOn.material.diffuse[2] > 1.0)
        handleKeyDown.modelOn.material.diffuse[2] = 0;
      console.log(handleKeyDown.modelOn.material.diffuse);
      break;
    case "Numpad3":
      vec3.add(handleKeyDown.modelOn.material.specular, handleKeyDown.modelOn.material.specular, vec3.fromValues(0.1, 0.1, 0.1));
      if (handleKeyDown.modelOn.material.specular[0] > 1.0)
        handleKeyDown.modelOn.material.specular[0] = 0;
      if (handleKeyDown.modelOn.material.specular[1] > 1.0)
        handleKeyDown.modelOn.material.specular[1] = 0;
      if (handleKeyDown.modelOn.material.specular[2] > 1.0)
        handleKeyDown.modelOn.material.specular[2] = 0;
      console.log(handleKeyDown.modelOn.material.specular);
      break;
    case "Backspace": // reset model transforms to default
      for (var whichTriSet = 0; whichTriSet < numTriangleSets; whichTriSet++) {
        vec3.set(inputTriangles[whichTriSet].translation, 0, 0, 0);
        vec3.set(inputTriangles[whichTriSet].xAxis, 1, 0, 0);
        vec3.set(inputTriangles[whichTriSet].yAxis, 0, 1, 0);
      } // end for all triangle sets
      for (var whichEllipsoid = 0; whichEllipsoid < numEllipsoids; whichEllipsoid++) {
        vec3.set(inputEllipsoids[whichEllipsoid].translation, 0, 0, 0);
        vec3.set(inputEllipsoids[whichTriSet].xAxis, 1, 0, 0);
        vec3.set(inputEllipsoids[whichTriSet].yAxis, 0, 1, 0);
      } // end for all ellipsoids
      break;
  } // end switch
} // end handleKeyDown

// set up the webGL environment
function setupWebGL() {

  // Set up keys
  document.onkeydown = handleKeyDown; // call this when key pressed
  // Get the image canvas, render an image in it
  var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
  var cw = imageCanvas.width,
    ch = imageCanvas.height;
  imageContext = imageCanvas.getContext("2d");
  var bkgdImage = new Image();
  bkgdImage.crossOrigin = "Anonymous";
  bkgdImage.src = "https://wma8.github.io/prog4/sky.jpg";
  bkgdImage.onload = function() {
    var iw = bkgdImage.width,
      ih = bkgdImage.height;
    imageContext.drawImage(bkgdImage, 0, 0, iw, ih, 0, 0, cw, ch);
  } // end onload callback

  // create a webgl canvas and set it up
  var webGLCanvas = document.getElementById("myWebGLCanvas"); // create a webgl canvas
  gl = webGLCanvas.getContext("webgl"); // get a webgl object from it
  try {
    if (gl == null) {
      throw "unable to create gl context -- is your browser gl ready?";
    } else {
      //gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
      gl.clearDepth(1.0); // use max when we clear the depth buffer
      gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
    }
  } // end try
  catch (e) {
    console.log(e);
  } // end catch

} // end setupWebGL

// read models in, load them into webgl buffers
function loadModels() {

  inputTriangles = getJSONFile(INPUT_IMAGE_TEST, "triangles"); // read in the triangle data

  try {
    if (inputTriangles == String.null)
      throw "Unable to load triangles file!";
    else {
      var whichSetVert; // index of vertex in current triangle set
      var whichSetTri; // index of triangle in current triangle set
      var vtxToAdd; // vtx coords to add to the coord array
      var normToAdd; // vtx normal to add to the coord array
      var uvsToAdd; // vtx uvs to add to the coord array
      var triToAdd; // tri indices to add to the index array
      var maxCorner = vec3.fromValues(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE); // bbox corner
      var minCorner = vec3.fromValues(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE); // other corner

      // process each triangle set to load webgl vertex and triangle buffers
      numTriangleSets = inputTriangles.length; // remember how many tri sets
      for (var whichSet = 0; whichSet < numTriangleSets; whichSet++) { // for each tri set
        // loads images
        var texURL = inputTriangles[whichSet].material.texture;
        inputTriangles[whichSet].texture = loadTexture(INPUT_IMAGE_PREFIX + texURL);
        console.log(texURL);
        // set up hilighting, modeling translation and rotation
        inputTriangles[whichSet].center = vec3.fromValues(0, 0, 0); // center point of tri set
        inputTriangles[whichSet].on = false; // not highlighted
        inputTriangles[whichSet].translation = vec3.fromValues(0, 0, 0); // no translation
        inputTriangles[whichSet].xAxis = vec3.fromValues(1, 0, 0); // model X axis
        inputTriangles[whichSet].yAxis = vec3.fromValues(0, 1, 0); // model Y axis

        // set up the vertex and normal arrays, define model center and axes
        inputTriangles[whichSet].glVertices = []; // flat coord list for webgl
        inputTriangles[whichSet].glNormals = []; // flat normal list for webgl
        inputTriangles[whichSet].gluvs = []; // flat uvs list for webgl
        var numVerts = inputTriangles[whichSet].vertices.length; // num vertices in tri set
        for (whichSetVert = 0; whichSetVert < numVerts; whichSetVert++) { // verts in set
          vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert]; // get vertex to add
          normToAdd = inputTriangles[whichSet].normals[whichSetVert]; // get normal to add
          uvsToAdd = inputTriangles[whichSet].uvs[whichSetVert];
          inputTriangles[whichSet].glVertices.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]); // put coords in set coord list
          inputTriangles[whichSet].glNormals.push(normToAdd[0], normToAdd[1], normToAdd[2]); // put normal in set coord list
          inputTriangles[whichSet].gluvs.push(uvsToAdd[0], uvsToAdd[1]); // put uvs in set coord list
          vec3.max(maxCorner, maxCorner, vtxToAdd); // update world bounding box corner maxima
          vec3.min(minCorner, minCorner, vtxToAdd); // update world bounding box corner minima
          vec3.add(inputTriangles[whichSet].center, inputTriangles[whichSet].center, vtxToAdd); // add to ctr sum
        } // end for vertices in set
        vec3.scale(inputTriangles[whichSet].center, inputTriangles[whichSet].center, 1 / numVerts); // avg ctr sum

        // send the vertex coords and normals to webGL
        vertexBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glVertices), gl.STATIC_DRAW); // data in
        normalBuffers[whichSet] = gl.createBuffer(); // init empty webgl set normal component buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].glNormals), gl.STATIC_DRAW); // data in

        uvsBuffers[whichSet] = gl.createBuffer(); // init empty webgl set vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(inputTriangles[whichSet].gluvs), gl.STATIC_DRAW); // data in

        // set up the triangle index array, adjusting indices across sets
        inputTriangles[whichSet].glTriangles = []; // flat index list for webgl
        triSetSizes[whichSet] = inputTriangles[whichSet].triangles.length; // number of tris in this set
        for (whichSetTri = 0; whichSetTri < triSetSizes[whichSet]; whichSetTri++) {
          triToAdd = inputTriangles[whichSet].triangles[whichSetTri]; // get tri to add
          inputTriangles[whichSet].glTriangles.push(triToAdd[0], triToAdd[1], triToAdd[2]); // put indices in set list
        } // end for triangles in set
        //console.log(inputTriangles[whichSet].glTriangles);

        // send the triangle indices to webGL
        triangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichSet]); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(inputTriangles[whichSet].glTriangles), gl.STATIC_DRAW); // data in
		
      } // end for each triangle set
      var temp = vec3.create();
      viewDelta = vec3.length(vec3.subtract(temp, maxCorner, minCorner)) / 100; // set global
    } // end if triangle file loaded
  } // end try
  catch (e) {
    console.log(e);
  } // end catch
} // end load models

// setup the webGL shaders
function setupShaders() {

  // define vertex shader in essl using es6 template strings
  var vShaderCode = `
        attribute vec3 aVertexPosition; // vertex position
        attribute vec3 aVertexNormal; // vertex normal
		attribute vec2 uvsCoord; // uvs position

		varying highp vec2 v_texcoord;
        uniform mat4 umMatrix; // the model matrix
        uniform mat4 upvmMatrix; // the project view model matrix

        varying vec3 vWorldPos; // interpolated world position of vertex
        varying vec3 vVertexNormal; // interpolated normal for frag shader

        void main(void) {

            // vertex position
			v_texcoord = uvsCoord;
            vec4 vWorldPos4 = umMatrix * vec4(aVertexPosition, 1.0);
            vWorldPos = vec3(vWorldPos4.x,vWorldPos4.y,vWorldPos4.z);
            gl_Position = upvmMatrix * vec4(aVertexPosition, 1.0);

            // vertex normal (assume no non-uniform scale)
            vec4 vWorldNormal4 = umMatrix * vec4(aVertexNormal, 0.0);
            vVertexNormal = normalize(vec3(vWorldNormal4.x,vWorldNormal4.y,vWorldNormal4.z));
        }
    `;

  // define fragment shader in essl using es6 template strings
  var fShaderCode = `
        precision mediump float; // set float to medium precision

		// uvs coordinate
		varying highp vec2 v_texcoord;

        uniform sampler2D u_sampler;
        // eye location
        uniform vec3 uEyePosition; // the eye's position in world

        // light properties
        uniform vec3 uLightAmbient; // the light's ambient color
        uniform vec3 uLightDiffuse; // the light's diffuse color
        uniform vec3 uLightSpecular; // the light's specular color
        uniform vec3 uLightPosition; // the light's position

        // material properties
        uniform vec3 uAmbient; // the ambient reflectivity
        uniform vec3 uDiffuse; // the diffuse reflectivity
        uniform vec3 uSpecular; // the specular reflectivity
        uniform float uShininess; // the specular exponent
		uniform float uAlpha; // the alpha reflectivity
        uniform bool Blinn_Phong;  // Blinn_Phong x Phong toggle
        uniform bool Switch; // Modulate b light toggle
        // geometry properties
        varying vec3 vWorldPos; // world xyz of fragment
        varying vec3 vVertexNormal; // normal of fragment

        void main(void) {

            // ambient term
            vec3 ambient = uAmbient*uLightAmbient;

            // diffuse term
            vec3 normal = normalize(vVertexNormal);
            vec3 light = normalize(uLightPosition - vWorldPos);
            float lambert = max(0.0,dot(normal,light));
            vec3 diffuse = uDiffuse*uLightDiffuse*lambert; // diffuse term

            // specular term
            vec3 eye = normalize(uEyePosition - vWorldPos);
            vec3 halfVec = normalize(light+eye);
            float ndotLight = 2.0*dot(normal, light);
            vec3 reflectVec = normalize(ndotLight*normal - light);
            float highlight = 0.0;
            if(Blinn_Phong)
           	 	highlight = pow(max(0.0,dot(normal,halfVec)),uShininess);
           	else
           		highlight = pow(max(0.0,dot(normal,reflectVec)),uShininess);

            vec3 specular = uSpecular*uLightSpecular*highlight; // specular term

            // combine to output color
            vec3 colorOut = ambient +diffuse +specular; // no specular yet
            vec4 temp = texture2D(u_sampler, v_texcoord);
            
            //gl_FragColor = vec4(colorOut, uAlpha);
            if(Switch)
                gl_FragColor = texture2D(u_sampler, v_texcoord) * vec4(colorOut, uAlpha);
            else
                gl_FragColor = texture2D(u_sampler, v_texcoord);
        }
    `;

  try {
    var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
    gl.shaderSource(fShader, fShaderCode); // attach code to shader
    gl.compileShader(fShader); // compile the code for gpu execution

    var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
    gl.shaderSource(vShader, vShaderCode); // attach code to shader
    gl.compileShader(vShader); // compile the code for gpu execution

    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
      throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
      gl.deleteShader(fShader);
    } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
      throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
      gl.deleteShader(vShader);
    } else { // no compile errors
      var shaderProgram = gl.createProgram(); // create the single shader program
      gl.attachShader(shaderProgram, fShader); // put frag shader in program
      gl.attachShader(shaderProgram, vShader); // put vertex shader in program
      gl.linkProgram(shaderProgram); // link program into gl context

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
        throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
      } else { // no shader program link errors
        gl.useProgram(shaderProgram); // activate shader program (frag and vert)

        // locate and enable vertex attributes
        vPosAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition"); // ptr to vertex pos attrib
        gl.enableVertexAttribArray(vPosAttribLoc); // connect attrib to array
        vNormAttribLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal"); // ptr to vertex normal attrib
        gl.enableVertexAttribArray(vNormAttribLoc); // connect attrib to array

        uvsAttribLoc = gl.getAttribLocation(shaderProgram, "uvsCoord");
        gl.enableVertexAttribArray(uvsAttribLoc); // connect attrib to array
        // locate vertex uniforms
        mMatrixULoc = gl.getUniformLocation(shaderProgram, "umMatrix"); // ptr to mmat
        pvmMatrixULoc = gl.getUniformLocation(shaderProgram, "upvmMatrix"); // ptr to pvmmat

        // locate fragment uniforms
        samplerImage = gl.getUniformLocation(shaderProgram, "u_sampler");
        var eyePositionULoc = gl.getUniformLocation(shaderProgram, "uEyePosition"); // ptr to eye position
        var lightAmbientULoc = gl.getUniformLocation(shaderProgram, "uLightAmbient"); // ptr to light ambient
        var lightDiffuseULoc = gl.getUniformLocation(shaderProgram, "uLightDiffuse"); // ptr to light diffuse
        var lightSpecularULoc = gl.getUniformLocation(shaderProgram, "uLightSpecular"); // ptr to light specular
        var lightPositionULoc = gl.getUniformLocation(shaderProgram, "uLightPosition"); // ptr to light position
        ambientULoc = gl.getUniformLocation(shaderProgram, "uAmbient"); // ptr to ambient
        diffuseULoc = gl.getUniformLocation(shaderProgram, "uDiffuse"); // ptr to diffuse
        specularULoc = gl.getUniformLocation(shaderProgram, "uSpecular"); // ptr to specular
        shininessULoc = gl.getUniformLocation(shaderProgram, "uShininess"); // ptr to shininess
		alphaULOC = gl.getUniformLocation(shaderProgram, "uAlpha"); // ptr to alpha
		
        Blinn_PhongULoc = gl.getUniformLocation(shaderProgram, "Blinn_Phong");
        SwitchLoc = gl.getUniformLocation(shaderProgram, "Switch");
        // pass global constants into fragment uniforms
        gl.uniform3fv(eyePositionULoc, Eye); // pass in the eye's position
        gl.uniform3fv(lightAmbientULoc, lightAmbient); // pass in the light's ambient emission
        gl.uniform3fv(lightDiffuseULoc, lightDiffuse); // pass in the light's diffuse emission
        gl.uniform3fv(lightSpecularULoc, lightSpecular); // pass in the light's specular emission
        gl.uniform3fv(lightPositionULoc, lightPosition); // pass in the light's position
      } // end if no shader program link errors
    } // end if no compile errors
  console.log(inputTriangles[1]);
  } // end try
  catch (e) {
    console.log(e);
  } // end catch
} // end setup shaders

// render the loaded model
function renderModels() {

  // construct the model transform matrix, based on model state
  function makeModelTransform(currModel) {
    var zAxis = vec3.create(),
      sumRotation = mat4.create(),
      temp = mat4.create(),
      negCtr = vec3.create();

    // move the model to the origin
    mat4.fromTranslation(mMatrix, vec3.negate(negCtr, currModel.center));

    // scale for highlighting if needed
    if (currModel.on)
      mat4.multiply(mMatrix, mat4.fromScaling(temp, vec3.fromValues(1.2, 1.2, 1.2)), mMatrix); // S(1.2) * T(-ctr)

    // rotate the model to current interactive orientation
    vec3.normalize(zAxis, vec3.cross(zAxis, currModel.xAxis, currModel.yAxis)); // get the new model z axis
    mat4.set(sumRotation, // get the composite rotation
      currModel.xAxis[0], currModel.yAxis[0], zAxis[0], 0,
      currModel.xAxis[1], currModel.yAxis[1], zAxis[1], 0,
      currModel.xAxis[2], currModel.yAxis[2], zAxis[2], 0,
      0, 0, 0, 1);
    mat4.multiply(mMatrix, sumRotation, mMatrix); // R(ax) * S(1.2) * T(-ctr)

    // translate back to model center
    mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.center), mMatrix); // T(ctr) * R(ax) * S(1.2) * T(-ctr)

    // translate model to current interactive orientation
    mat4.multiply(mMatrix, mat4.fromTranslation(temp, currModel.translation), mMatrix); // T(pos)*T(ctr)*R(ax)*S(1.2)*T(-ctr)

  } // end make model transform

  // var hMatrix = mat4.create(); // handedness matrix
  var pMatrix = mat4.create(); // projection matrix
  var vMatrix = mat4.create(); // view matrix
  var mMatrix = mat4.create(); // model matrix
  var pvMatrix = mat4.create(); // hand * proj * view matrices
  var pvmMatrix = mat4.create(); // hand * proj * view * model matrices

  window.requestAnimationFrame(renderModels); // set up frame render callback
  

  // set up projection and view
  // mat4.fromScaling(hMatrix,vec3.fromValues(-1,1,1)); // create handedness matrix
  mat4.perspective(pMatrix, 0.5 * Math.PI, 1, 0.1, 10); // create projection matrix
  mat4.lookAt(vMatrix, Eye, Center, Up); // create view matrix
  mat4.multiply(pvMatrix, pvMatrix, pMatrix); // projection
  mat4.multiply(pvMatrix, pvMatrix, vMatrix); // projection * view

  // add sorting algorithms
  // first sort opaque objects and render
  var sortedIndex = [];
  var temp = 0;
  for(var i = 0; i < numTriangleSets; i++) {
	  if(inputTriangles[i].material.alpha == 1.0) {
		  sortedIndex[temp++] = i;
	  }
  }
  var currSet; // the tri set and its material properties
  //console.log(numTriangleSets);
  
  // render opaque objects with z-buffering on
  gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
  var whichSet = 0;
  // render the opaque objects.
  gl.disable(gl.BLEND);
  while (whichSet < temp) {
	whichTriSet = sortedIndex[whichSet];
    currSet = inputTriangles[whichTriSet];
	
    // make model transform, add to view project
    makeModelTransform(currSet);
    mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
    gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
    gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

    // reflectivity: feed to the fragment shader
    gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
    gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
    gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
    gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
	gl.uniform1f(alphaULOC, currSet.material.alpha); // pass in the alpha reflectivity
    gl.uniform1i(Blinn_PhongULoc, Blinn_Phong);
    gl.uniform1i(SwitchLoc, Switch);
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffers[whichTriSet]); // activate
    gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[whichTriSet]); // activate
    gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

    gl.bindBuffer(gl.ARRAY_BUFFER, uvsBuffers[whichTriSet]); // activate
    gl.vertexAttribPointer(uvsAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currSet.texture);
    gl.uniform1i(samplerImage, 0);
    // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffers[whichTriSet]); // activate
    gl.drawElements(gl.TRIANGLES, 3 * triSetSizes[whichTriSet], gl.UNSIGNED_SHORT, 0); // render
	whichSet++;
  } // end for each triangle set
  
  // render the transparent objects and sort TODO.
  // Finish the algorithm with the distances.
  var nonOpaque = [];
  var count = 0;
  for(var j = 0; j < numTriangleSets; j++) {
	  if(inputTriangles[j].material.alpha != 1.0) {
		  nonOpaque[count++] = j;
	  }
  }
  //console.log(nonOpaque);
		var sortedTri = reordering(nonOpaque);
		var reLength = sortedTri.length;
		var currSet;
		
		for(var i = 0; i < reLength; i++) {
			currSet = sortedTri[i];
	
			// make model transform, add to view project
			makeModelTransform(currSet);
			mat4.multiply(pvmMatrix, pvMatrix, mMatrix); // project * view * model
			gl.uniformMatrix4fv(mMatrixULoc, false, mMatrix); // pass in the m matrix
			gl.uniformMatrix4fv(pvmMatrixULoc, false, pvmMatrix); // pass in the hpvm matrix

			// Assign the distance parameter to each tri
			//getDistance(v, eye)
			currSet.distance = getDistance(currSet.center, Eye);

			nVertexBuffers[i] = gl.createBuffer(); // init empty webgl set vertex coord buffer
			gl.bindBuffer(gl.ARRAY_BUFFER, nVertexBuffers[i]); // activate that buffer
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currSet.vertices), gl.STATIC_DRAW); // data in
			
			nNormalBuffers[i] = gl.createBuffer(); // init empty webgl set normal component buffer
			gl.bindBuffer(gl.ARRAY_BUFFER, nNormalBuffers[i]); // activate that buffer
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currSet.normals), gl.STATIC_DRAW); // data in

			nUvsBuffers[i] = gl.createBuffer(); // init empty webgl set vertex coord buffer
			gl.bindBuffer(gl.ARRAY_BUFFER, nUvsBuffers[i]); // activate that buffer
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(currSet.uvs), gl.STATIC_DRAW); // data in

			nTriangleBuffers.push(gl.createBuffer()); // init empty triangle index buffer
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nTriangleBuffers[i]); // activate that buffer
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(currSet.triangles), gl.STATIC_DRAW); // data in
		}
		sortedTri = insertionSort(sortedTri);
		
		var whichSet = 0;
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		// Turn off updating of the z-buffer
		gl.depthMask(false);
		while (whichSet < reLength) {
			currSet = sortedTri[whichSet];

			// reflectivity: feed to the fragment shader
			gl.uniform3fv(ambientULoc, currSet.material.ambient); // pass in the ambient reflectivity
			gl.uniform3fv(diffuseULoc, currSet.material.diffuse); // pass in the diffuse reflectivity
			gl.uniform3fv(specularULoc, currSet.material.specular); // pass in the specular reflectivity
			gl.uniform1f(shininessULoc, currSet.material.n); // pass in the specular exponent
			gl.uniform1f(alphaULOC, currSet.material.alpha); // pass in the alpha reflectivity
			gl.uniform1i(Blinn_PhongULoc, Blinn_Phong);
			gl.uniform1i(SwitchLoc, Switch);
			// vertex buffer: activate and feed into vertex shader
			gl.bindBuffer(gl.ARRAY_BUFFER, nVertexBuffers[whichSet]); // activate
			gl.vertexAttribPointer(vPosAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed
			gl.bindBuffer(gl.ARRAY_BUFFER, nNormalBuffers[whichSet]); // activate
			gl.vertexAttribPointer(vNormAttribLoc, 3, gl.FLOAT, false, 0, 0); // feed

			gl.bindBuffer(gl.ARRAY_BUFFER, nUvsBuffers[whichSet]); // activate
			gl.vertexAttribPointer(uvsAttribLoc, 2, gl.FLOAT, false, 0, 0); // feed

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, currSet.texture);
			gl.uniform1i(samplerImage, 0);
			// triangle buffer: activate and render
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nTriangleBuffers[whichSet]); // activate
			gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0); // render
			whichSet++;
		} // end for each triangle set

  
} // end render model

function insertionSort(array) {
  var length = array.length;
  
  for(var i = 1, j; i < length; i++) {
    var temp = array[i];
	var temp2 = nVertexBuffers[i];
	var temp3 = nNormalBuffers[i];
	var temp4 = nUvsBuffers[i]; 
	var temp5 = nTriangleBuffers[i];
    for(var j = i - 1; j >= 0 && array[j].distance < temp.distance; j--) {
      array[j+1] = array[j];
	  nVertexBuffers[j+1] = nVertexBuffers[j];
	  nNormalBuffers[j+1] = nNormalBuffers[j];
	  nUvsBuffers[j+1] = nUvsBuffers[j];
	  nTriangleBuffers[j+1] = nTriangleBuffers[j];
    }
    array[j+1] = temp;
	nVertexBuffers[j+1] = temp2;
	nNormalBuffers[j+1] = temp3;
	nUvsBuffers[j+1] = temp4;
	nTriangleBuffers[j+1] = temp5;
  }
  
  return array;
}


function reordering(nonOpaque) {
	var sortedTri = [];
	var count2 = 0;
	for(var i = 0; i < nonOpaque.length; i++) {
		var temp = inputTriangles[nonOpaque[i]];
		var numTri = temp.triangles.length;
		for(var j = 0; j < numTri; j++) {
			sortedTri[count2] = [];
			sortedTri[count2].triangles = inputTriangles[nonOpaque[i]].triangles[j];
			sortedTri[count2].normals = inputTriangles[nonOpaque[i]].glNormals;
			sortedTri[count2].vertices = inputTriangles[nonOpaque[i]].glVertices;
			sortedTri[count2].uvs = inputTriangles[nonOpaque[i]].gluvs;
			sortedTri[count2].material = inputTriangles[nonOpaque[i]].material;
			sortedTri[count2].on = inputTriangles[nonOpaque[i]].on;
			sortedTri[count2].texture = inputTriangles[nonOpaque[i]].texture;
			// Wrong way to find the center here
				var Tvertices = sortedTri[count2].vertices;
				var first = sortedTri[count2].triangles[0];
				var second = sortedTri[count2].triangles[1];
				var third = sortedTri[count2].triangles[2];
				var vone = vec3.fromValues(Tvertices[3*first], Tvertices[3*first+1], Tvertices[3*first+2]);
				var vtwo = vec3.fromValues(Tvertices[3*second], Tvertices[3*second+1], Tvertices[3*second+2]);
				var vthree = vec3.fromValues(Tvertices[3*third], Tvertices[3*third+1], Tvertices[3*third+2]);
				var temp = vec3.create(); 
				vec3.add(vone, vtwo, temp);
				vec3.add(temp, vthree, temp);
				vec3.scale(temp, temp, 1/3);
	

			sortedTri[count2].center = temp;
			sortedTri[count2].translation = inputTriangles[nonOpaque[i]].translation;
			sortedTri[count2].xAxis = inputTriangles[nonOpaque[i]].xAxis;
			sortedTri[count2++].yAxis = inputTriangles[nonOpaque[i]].yAxis;
			


		}
	}
	return sortedTri;
}

function getDistance(v, eye) {
	var dx = v[0] - eye[0];
	var dy = v[1] - eye[1];
	var dz = v[2] - eye[2];
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/* MAIN -- HERE is where execution begins after window load */

function main() {

  setupWebGL(); // set up the webGL environment
  loadModels(); // load in the models from tri file
  setupShaders(); // setup the webGL shaders
  renderModels(); // draw the triangles using webGL

} // end main
