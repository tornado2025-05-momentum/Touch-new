import TrackPlayer from 'react-native-track-player';

module.exports = async function() {
    TrackPlayer.addEventListener('remote-play', () => TrackPlayer.play());
    TrackPlayer.addEventListener('remote-pause', () => TrackPlayer.pause());
    // その他のイベント（スキップなど）もここに追加できますが、今回はシンプルにこれだけでOKです。
};