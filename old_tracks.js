(function () {
  'use strict';

  var connect_host = '{localhost}';
  var list_opened = false;

  var unic_id = Lampa.Storage.get('lampac_unic_id', '');
  if (!unic_id) {
    unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('lampac_unic_id', unic_id);
  }

  function reguest(params, callback) {
    if (params.ffprobe) {
      setTimeout(function () {
        callback({ streams: params.ffprobe });
      }, 200);
    } else {
      var net = new Lampa.Reguest();
      net.timeout(1000 * 15);

      var url = connect_host + '/ffprobe?media=' + encodeURIComponent(params.url);

      net["native"](url, function (str) {
        var json = {};
        try { json = JSON.parse(str); } catch (e) {}
        if (json.streams) callback(json);
      }, false, false, { dataType: 'text' });
    }
  }

  function subscribeTracks(data) {
    var inited_parse = false;

    function getTracks() {
      return Lampa.PlayerVideo.video().audioTracks || [];
    }

    function setTracks() {
      if (!inited_parse) return;

      var new_tracks = [];
      var video_tracks = getTracks();

      var parse_tracks = inited_parse.streams.filter(function (a) {
        return a.codec_type == 'audio' && a.tags;
      });

      var minus = 1;

      parse_tracks.forEach(function (track) {
        var index = track.index - minus;
        var orig = video_tracks[index];

        var elem = {
          index: index,
          language: track.tags.language,
          label: track.tags.title || track.tags.handler_name,
          ghost: orig ? false : true,
          selected: false
        };

        Object.defineProperty(elem, "enabled", {
          set: function (v) {
            if (v) {
              var aud = getTracks();
              for (var i = 0; i < aud.length; i++) {
                aud[i].enabled = false;
                aud[i].selected = false;
              }
              if (aud[elem.index]) {
                aud[elem.index].enabled = true;
                aud[elem.index].selected = true;
              }
            }
          }
        });

        new_tracks.push(elem);
      });

      // ✅ авто-выбор RU → первая
      if (new_tracks.length) {
        var found_ru = new_tracks.find(function (t) {
          return (t.language || '').toLowerCase().includes('ru');
        });

        if (found_ru) found_ru.selected = true;
        else new_tracks[0].selected = true;
      }

      Lampa.PlayerPanel.setTracks(new_tracks);
    }

    function start() {
      reguest(data, function (result) {
        inited_parse = result;
        setTracks();
      });
    }

    start();
  }

  Lampa.Player.listener.follow('start', function (data) {
    if (data.torrent_hash) subscribeTracks(data);
  });

})();