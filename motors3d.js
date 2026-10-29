/* ============================================================
 * Three.js 电机 3D 查看器 v3
 * 支持：真实 CAD GLB 模型（按零件分层爆炸）+ 程序化模型（备用）
 * ============================================================ */
function createMotorViewer(containerEl) {
  let scene, camera, renderer, controls;
  let modelRoot = null;
  let partMeshes = {};      // key -> { group, meshes[], home, dir, data:{label,desc,color} }
  let exploded = false, explodeDist = 1;
  let raycaster, pointer;
  let onPartClickCb = null;
  let onHoverCb = null;
  let onLoadedCb = null;
  let container = containerEl;
  let dead = false;
  let spinParts = [];       // 程序化旧结构兼容
  let explodeFactor = 1;    // 爆炸幅度（滑条）

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f7fb);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(container.clientHeight, 1), 0.01, 100);
  camera.position.set(6.2, 4.2, 8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, Math.max(container.clientHeight, 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 1.4;

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(5, 8, 6);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
  dir2.position.set(-5, 3, -4);
  scene.add(dir2);
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0xf2e8d9, 0.35));

  const grid = new THREE.GridHelper(14, 28, 0xc5d3e8, 0xdde7f4);
  grid.position.y = -2.6;
  scene.add(grid);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', () => { if (onHoverCb) onHoverCb(null); });
  renderer.domElement.addEventListener('pointerdown', () => { controls.autoRotate = false; });
  renderer.domElement.addEventListener('click', onClick);

  const resize = () => {
    if (dead || !container.isConnected) return;
    const w = container.clientWidth, h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(container);

  function clearModel() {
    if (!modelRoot) return;
    scene.remove(modelRoot);
    modelRoot.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    modelRoot = null;
    partMeshes = {};
    spinParts = [];
    exploded = false;
  }

  /* ---------- GLB 真实模型 ---------- */
  function loadGLB(url, meta) {
    clearModel();
    const loader = new THREE.GLTFLoader();
    loader.load(url, (gltf) => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      scene.add(root);
      modelRoot = root;

      const partMap = (meta && meta.partMap) || [];
      const assemblyCenter = new THREE.Vector3(0, 0, 0);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      explodeDist = maxDim * ((meta && meta.explode) || 0.55);

      /* ---- 先收集所有零件中心 ---- */
      const entries = [];
      root.children.forEach(child => {
        const meshes = [];
        child.traverse(o => {
          if (o.isMesh) {
            o.userData.partKey = child.name;
            meshes.push(o);
          }
        });
        if (!meshes.length) return;
        const cbox = new THREE.Box3().setFromObject(child);
        const c = cbox.getCenter(new THREE.Vector3()).sub(center);
        entries.push({ child, meshes, c });
      });

      /* ---- PCA 求电机主轴（零件中心分布最广方向） ---- */
      const mean = new THREE.Vector3();
      entries.forEach(e => mean.add(e.c));
      mean.multiplyScalar(1 / Math.max(entries.length, 1));
      let cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      entries.forEach(e => {
        const d = [e.c.x - mean.x, e.c.y - mean.y, e.c.z - mean.z];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += d[i] * d[j];
      });
      let axis = new THREE.Vector3(1, 0, 0);
      for (let it = 0; it < 24; it++) {
        const nx = cov[0][0] * axis.x + cov[0][1] * axis.y + cov[0][2] * axis.z;
        const ny = cov[1][0] * axis.x + cov[1][1] * axis.y + cov[1][2] * axis.z;
        const nz = cov[2][0] * axis.x + cov[2][1] * axis.y + cov[2][2] * axis.z;
        axis.set(nx, ny, nz);
        if (axis.length() < 1e-9) { axis.set(1, 0, 0); break; }
        axis.normalize();
      }
      // 方向统一：最大分量取正
      const am = [Math.abs(axis.x), Math.abs(axis.y), Math.abs(axis.z)];
      const mi = am.indexOf(Math.max(...am));
      if (axis.getComponent(mi) < 0) axis.negate();

      let maxProj = 0.001;
      entries.forEach(e => { maxProj = Math.max(maxProj, Math.abs(e.c.clone().sub(mean).dot(axis))); });

      /* ---- 每个零件：轴向分级 + 径向分离 ---- */
      const partPush = (meta && meta.partPush) || [];
      entries.forEach(e => {
        const lname = e.child.name.toLowerCase();
        let info = null;
        for (const rule of partMap) {
          if (rule.m.some(k => lname.includes(k.toLowerCase()))) { info = rule; break; }
        }
        let colorHex = '#9aa5b1';
        const m0 = e.meshes[0].material;
        if (m0 && m0.color) colorHex = '#' + m0.color.getHexString();

        const rel = e.c.clone().sub(mean);
        const proj = rel.dot(axis);
        const radialVec = rel.clone().addScaledVector(axis, -proj);
        if (radialVec.length() < 1e-4) {
          radialVec.set(axis.y, axis.z, axis.x); // 任意不正交向量
          radialVec.addScaledVector(axis, -radialVec.dot(axis));
        }
        radialVec.normalize();

        // 定向推离覆盖（如 PMSM 定子从转子壳中抽出）
        let dirv, distScale = 1;
        const push = partPush.find(p => p.m.some(k => lname.includes(k.toLowerCase())));
        if (push) {
          const sgn = Math.sign(proj) || 1;
          dirv = axis.clone().multiplyScalar((push.axis || 0) * sgn).addScaledVector(radialVec, push.radial || 0);
          if (push.scale) distScale = push.scale;
        } else {
          // 轴向分级：端部零件移出更远；同轴零件靠径向分量错开
          const grade = 0.45 + 0.85 * (Math.abs(proj) / maxProj);
          dirv = axis.clone().multiplyScalar(Math.sign(proj || 1) * grade).addScaledVector(radialVec, 0.5);
        }
        if (dirv.length() < 1e-6) dirv.set(0, 1, 0);
        dirv.normalize();

        partMeshes[e.child.name] = {
          group: e.child, meshes: e.meshes,
          home: e.child.position.clone(),
          dir: dirv, distScale,
          data: {
            label: info ? info.label : e.child.name,
            desc: info ? info.desc : '紧固件 / 辅助结构件。',
            color: colorHex
          }
        };
      });

      // 相机适配
      const fit = maxDim * 1.9;
      camera.position.set(fit * 0.75, fit * 0.5, fit);
      camera.far = Math.max(100, fit * 20);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      resize();
      if (onLoadedCb) onLoadedCb(Object.keys(partMeshes).length);
    }, undefined, (err) => {
      console.error('GLB load fail', err);
      if (onLoadedCb) onLoadedCb(-1);
    });
  }

  /* ---------- 程序化模型（旧版兼容） ---------- */
  function buildPartMesh(partKey, p) {
    let geo;
    if (p.kind === 'cyl') geo = new THREE.CylinderGeometry(p.r, p.r, p.h, 40);
    else if (p.kind === 'box') geo = new THREE.BoxGeometry(p.w, p.h, p.d);
    else if (p.kind === 'ring') geo = new THREE.CylinderGeometry(p.r, p.r, p.h, 40, 1, true);
    else geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color, roughness: 0.5, metalness: 0.32,
      side: p.kind === 'ring' ? THREE.DoubleSide : THREE.FrontSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    if (p.kind === 'cyl' || p.kind === 'ring') mesh.rotation.z = Math.PI / 2;
    mesh.userData.partKey = partKey;
    return mesh;
  }
  function loadMotor(motorId) {
    clearModel();
    const def = MOTOR_3D[motorId];
    if (!def) return;
    modelRoot = new THREE.Group();
    Object.entries(def.parts).forEach(([key, p]) => {
      const mesh = buildPartMesh(key, p);
      const entry = { group: mesh, meshes: [mesh], home: mesh.position.clone(), dir: new THREE.Vector3(p.offset[0], p.offset[1], p.offset[2]).normalize(), data: { label: p.label, desc: p.desc, color: p.color } };
      entry.offsetVec = new THREE.Vector3(p.offset[0], p.offset[1], p.offset[2]);
      partMeshes[key] = entry;
      modelRoot.add(mesh);
    });
    scene.add(modelRoot);
    camera.position.set(6.2, 4.2, 8);
    camera.far = 100;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    resize();
    if (onLoadedCb) onLoadedCb(Object.keys(partMeshes).length);
  }

  function setExplode(on) { exploded = on; }

  function selectPart(key) {
    Object.values(partMeshes).forEach(v => v.meshes.forEach(m => {
      if (m.userData._em === undefined) { m.userData._em = m.material.emissive ? m.material.emissive.getHex() : 0; m.userData._ei = m.material.emissiveIntensity || 0; }
      if (m.material.emissive) { m.material.emissive.setHex(m.userData._em); m.material.emissiveIntensity = m.userData._ei; }
    }));
    if (key && partMeshes[key]) {
      partMeshes[key].meshes.forEach(m => {
        if (m.material.emissive) { m.material.emissive.setHex(0x165dff); m.material.emissiveIntensity = 0.4; }
      });
    }
  }

  function pick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = [];
    Object.values(partMeshes).forEach(v => meshes.push(...v.meshes));
    return raycaster.intersectObjects(meshes, false);
  }

  function onPointerMove(e) {
    const hits = pick(e);
    renderer.domElement.style.cursor = hits.length ? 'pointer' : 'grab';
    if (onHoverCb) {
      if (hits.length) {
        const rect = renderer.domElement.getBoundingClientRect();
        const key = hits[0].object.userData.partKey;
        onHoverCb({ label: partMeshes[key] ? partMeshes[key].data.label : key, x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else onHoverCb(null);
    }
  }

  function onClick(e) {
    const hits = pick(e);
    if (hits.length) {
      const key = hits[0].object.userData.partKey;
      selectPart(key);
      if (onPartClickCb && partMeshes[key]) onPartClickCb(key, partMeshes[key].data);
    }
  }

  function animate() {
    if (dead) return;
    requestAnimationFrame(animate);
    Object.values(partMeshes).forEach(v => {
      const target = v.home.clone();
      if (exploded) {
        if (v.offsetVec) target.add(v.offsetVec);
        else target.addScaledVector(v.dir, explodeDist * explodeFactor * (v.distScale || 1));
      }
      v.group.position.lerp(target, 0.09);
    });
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    loadGLB,
    loadMotor,
    setExplode,
    setExplodeFactor: (f) => { explodeFactor = Math.max(0.1, Math.min(3, f)); },
    selectPart,
    setAutoRotate: (on) => { controls.autoRotate = on; },
    resetView: () => {
      const fit = camera.position.length() || 10;
      camera.position.set(fit * 0.75, fit * 0.5, fit);
      controls.target.set(0, 0, 0);
    },
    onPartClick: (cb) => { onPartClickCb = cb; },
    onHover: (cb) => { onHoverCb = cb; },
    onLoaded: (cb) => { onLoadedCb = cb; },
    getParts: () => Object.entries(partMeshes).map(([k, v]) => ({ key: k, label: v.data.label, desc: v.data.desc, color: v.data.color })),
    resize,
    dispose: () => {
      dead = true;
      clearModel();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
