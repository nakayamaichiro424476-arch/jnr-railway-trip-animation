// --- 地図初期化 ---
var map = L.map('map').setView([34.3437, 134.8957], 10);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// --- 路線一覧 ---
const ROUTES = {
  route_1: { color: "red",    path: "routes/route_1/" },
  route_2: { color: "blue",   path: "routes/route_2/" },
  route_3: { color: "green",  path: "routes/route_3/" },
  route_4: { color: "purple", path: "routes/route_4/" },
  route_5: { color: "red",    path: "routes/route_5/" },
  route_6: { color: "blue",   path: "routes/route_6/" },
  route_7: { color: "green",  path: "routes/route_7/" },
  route_8: { color: "purple", path: "routes/route_8/" },
  route_9: { color: "red",    path: "routes/route_9/" }
};

// --- グローバル変数 ---
let coords = [];
let stopStations = [];
let index = 0;
let autoMode = false;
let marker;
let currentRouteKey = null;

// --- キャラクター初期化 ---
marker = L.marker([0, 0]).addTo(map);

// --- 駅に近いかどうか ---
function isNearStation(lat, lng, sLat, sLng) {
  const dx = lat - sLat;
  const dy = lng - sLng;
  return Math.sqrt(dx * dx + dy * dy) < 0.00001;
}

// --- 路線読み込み ---
function loadRoute(routeKey, callback) {
  currentRouteKey = routeKey;
  autoMode = false;

  const r = ROUTES[routeKey];
  const routeFile   = r.path + "route.geojson";
  const stationFile = r.path + "stations.geojson";
  const stopFile    = r.path + "stopStations.geojson";

  if (window.routeLayer)   map.removeLayer(window.routeLayer);
  if (window.stationLayer) map.removeLayer(window.stationLayer);

  Promise.all([
    fetch(routeFile).then(res => res.json()),
    fetch(stationFile).then(res => res.json()),
    fetch(stopFile).then(res => res.json())
  ]).then(([routeData, stationData, stopData]) => {

    stopStations = stopData.features;

    // --- 路線描画 ---
    window.routeLayer = L.geoJSON(routeData, {
      style: { color: r.color, weight: 4 }
    }).addTo(map);

    coords = routeData.features[0].geometry.coordinates;
    index = 0;

    const startLat = coords[0][1];
    const startLng = coords[0][0];

    // ★ marker を始点に移動
    marker.setLatLng([startLat, startLng]);
    map.setView([startLat, startLng], 14);

    // --- 始点キャラクター設定（駅名＋路線名一致方式） ---
    const firstStation = stationData.features[0].properties;
    const firstStop = stopStations.find(st =>
      st.properties.N05_011 === firstStation.N05_011 &&
      st.properties.N05_002 === firstStation.N05_002
    );

    // --- 駅描画 ---
    window.stationLayer = L.geoJSON(stationData, {
      pointToLayer: function (feature, latlng) {
        const name = feature.properties.N05_011;

        L.circleMarker(latlng, {
          radius: 4,
          color: r.color,
          fillColor: r.color,
          fillOpacity: 0.9
        }).addTo(map);

        L.marker(latlng, {
          icon: L.divIcon({
            className: 'station-label',
            html: `<span>${name}</span>`,
            iconSize: [100, 20],
            iconAnchor: [-10, 10]
          })
        }).addTo(map);
      }
    }).addTo(map);

    // --- 始点 popup ---
    if (firstStop) {
      const name = firstStop.properties.N05_011;
      const desc = firstStop.properties.desc || "";
      const imgs = firstStop.properties.img || [];
      const routePath = ROUTES[currentRouteKey].path;

      let imgHtml = "";

    // --- 編成未表示化 --- //
      //if (firstStop.properties.hensei) {
        //imgHtml += `<img class="popup-img" src="${routePath}img/${firstStop.properties.hensei}" width="150"><br>`;
      //}

      if (firstStop.properties.stopStation) {
        imgHtml += `<img class="popup-img" src="${routePath}img/${firstStop.properties.stopStation}" width="150"><br>`;
      }

      imgs.forEach(file => {
        imgHtml += `<img class="popup-img" src="${routePath}img/${file}" width="150"><br>`;
      });

      const popupContent = `
        <h3>${name}駅（始点）</h3>
        ${imgHtml}
        <p>${desc}</p>
      `;
      marker.bindPopup(popupContent).openPopup();
    }

    // ★★★ 追加：始点 popup の画像をライトボックスに登録する ★★★
    setTimeout(() => {
      const popupNode = marker.getPopup().getElement();
      if (popupNode) {
        const allImgs = popupNode.querySelectorAll("img.popup-img");
        if (allImgs.length > 0) {
          currentImgs = Array.from(allImgs).map(img => img.src);
          currentIndex = 0;

          allImgs.forEach((img, idx) => {
            img.onclick = function () {
              currentIndex = idx;
              modalImg.src = currentImgs[idx];
              imgModal.style.display = "flex";
              modalImg.style.transform = "scale(1)";
              currentScale = 1;
            };
          });
        }
      }
    }, 50);

    // ★★★ popup 表示後にキャラ設定（Leaflet の DOM 再生成対策） ★★★
    if (firstStop && firstStop.properties.character) {
      const charFile = `${r.path}img/${firstStop.properties.character}`;
      const icon = L.icon({
        iconUrl: charFile,
        iconSize: [26, 32]
      });
      marker.setIcon(icon);
    }

    if (callback) callback();
    });
  }

// --- 自動運転 ---
function autoMove(callback) {
  if (!autoMode) return;

  if (index < coords.length - 1) {
    index++;

    const lat = coords[index][1];
    const lng = coords[index][0];

    marker.setLatLng([lat, lng]);
    map.panTo([lat, lng], { animate: true });

    stopStations.forEach(st => {
      const sLat = st.geometry.coordinates[1];
      const sLng = st.geometry.coordinates[0];

      if (index > 1 && isNearStation(lat, lng, sLat, sLng)) {
        autoMode = false;

        const name = st.properties.N05_011;
        const desc = st.properties.desc || "";
        const imgs = st.properties.img || [];
        const routePath = ROUTES[currentRouteKey].path;

        // ★ 停車駅キャラクター切替
        if (st.properties.character) {
          const charFile = `${routePath}img/${st.properties.character}`;
          const icon = L.icon({
            iconUrl: charFile,
            iconSize: [32, 32]
          });
          marker.setIcon(icon);
        }

        let imgHtml = "";

        // --- 編成未表示化 --- //
        //if (st.properties.hensei) {
          //imgHtml += `<img class="popup-img" src="${routePath}img/${st.properties.hensei}" width="150"><br>`;
        //}

        if (st.properties.stopStation) {
          imgHtml += `<img class="popup-img" src="${routePath}img/${st.properties.stopStation}" width="150"><br>`;
        }

        imgs.forEach(file => {
          imgHtml += `<img class="popup-img" src="${routePath}img/${file}" width="150"><br>`;
        });

        const popupContent = `
          <h3>${name}駅</h3>
          ${imgHtml}
          <p>${desc}</p>
        `;
        marker.bindPopup(popupContent).openPopup();
      }
    });

    setTimeout(() => autoMove(callback), 120 / 6);
  } else {
    if (callback) callback();
  }
}

// --- Route ボタン ---
document.querySelectorAll('#controls button[data-route]').forEach(btn => {
  btn.onclick = () => {
    const routeKey = btn.dataset.route;
    loadRoute(routeKey);
  };
});

// --- 開始ボタン ---
document.getElementById('start').onclick = function () {
  marker.closePopup();
  autoMode = true;
  autoMove();
};

// ===============================
// 画像最大化＋左右矢印＋拡大縮小ライトボックス（完全版）
// ===============================

// モーダル作成
const imgModal = document.createElement("div");
imgModal.id = "imgModal";
imgModal.style.position = "fixed";
imgModal.style.top = "0";
imgModal.style.left = "0";
imgModal.style.width = "100%";
imgModal.style.height = "100%";
imgModal.style.background = "rgba(0,0,0,0.85)";
imgModal.style.display = "none";
imgModal.style.justifyContent = "center";
imgModal.style.alignItems = "center";
imgModal.style.zIndex = "9999";
imgModal.style.overflow = "hidden";

const modalImg = document.createElement("img");
modalImg.style.maxWidth = "95%";
modalImg.style.maxHeight = "95%";
modalImg.style.border = "4px solid white";
modalImg.style.borderRadius = "10px";
modalImg.style.transition = "transform 0.1s ease-out";

imgModal.appendChild(modalImg);
document.body.appendChild(imgModal);

// 左右矢印
const prevBtn = document.createElement("div");
prevBtn.innerHTML = "◀";
prevBtn.style.position = "absolute";
prevBtn.style.left = "20px";
prevBtn.style.top = "50%";
prevBtn.style.fontSize = "40px";
prevBtn.style.color = "white";
prevBtn.style.cursor = "pointer";

const nextBtn = document.createElement("div");
nextBtn.innerHTML = "▶";
nextBtn.style.position = "absolute";
nextBtn.style.right = "20px";
nextBtn.style.top = "50%";
nextBtn.style.fontSize = "40px";
nextBtn.style.color = "white";
nextBtn.style.cursor = "pointer";

imgModal.appendChild(prevBtn);
imgModal.appendChild(nextBtn);

// モーダルを閉じる
imgModal.onclick = () => {
  imgModal.style.display = "none";
  modalImg.style.transform = "scale(1)";
  currentScale = 1;
};

// 拡大縮小（ホイール）
let currentScale = 1;
modalImg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  currentScale = Math.min(Math.max(currentScale + delta, 0.5), 5);
  modalImg.style.transform = `scale(${currentScale})`;
});

// 現在の画像リスト
let currentImgs = [];
let currentIndex = 0;

// popup が開いた瞬間に画像クリックイベントを登録
map.on("popupopen", function (e) {

  const allImgs = e.popup._contentNode.querySelectorAll("img.popup-img");
  if (!allImgs || allImgs.length === 0) return;

  currentImgs = Array.from(allImgs).map(img => img.src);
  currentIndex = 0;

  allImgs.forEach((img, idx) => {
    img.onclick = function () {
      currentIndex = idx;
      modalImg.src = currentImgs[idx];
      imgModal.style.display = "flex";
      modalImg.style.transform = "scale(1)";
      currentScale = 1;
    };
  });
});

// 次へ
nextBtn.onclick = function (e) {
  e.stopPropagation();
  if (currentIndex < currentImgs.length - 1) {
    currentIndex++;
    modalImg.src = currentImgs[currentIndex];
    modalImg.style.transform = "scale(1)";
    currentScale = 1;
  }
};

// 前へ
prevBtn.onclick = function (e) {
  e.stopPropagation();
  if (currentIndex > 0) {
    currentIndex--;
    modalImg.src = currentImgs[currentIndex];
    modalImg.style.transform = "scale(1)";
    currentScale = 1;
  }
};
