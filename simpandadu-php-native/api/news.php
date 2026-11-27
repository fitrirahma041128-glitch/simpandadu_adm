<?php
/**
 * Pengambil Berita Indonesia Terkini (RSS Nasional + Cache MySQL + Fallback Aman)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/helpers.php';

function classify_news_category(string $title, string $summary, string $defaultCat = 'Nasional'): string
{
    $text = mb_strtolower($title . ' ' . $summary);
    $rules = [
        'Politik' => ['dpr', 'pemilu', 'pilkada', 'presiden', 'menteri', 'kpk', 'parpol', 'legislatif'],
        'Ekonomi' => ['ekonomi', 'rupiah', 'inflasi', 'umkm', 'apbn', 'pajak', 'investasi', 'ihsg', 'ekspor', 'harga beras'],
        'Teknologi' => ['teknologi', 'digital', 'ai', 'internet', 'siber', 'aplikasi', 'startup', 'komdigi'],
        'Pendidikan' => ['pendidikan', 'sekolah', 'kampus', 'mahasiswa', 'kurikulum', 'guru', 'beasiswa'],
        'Kesehatan' => ['kesehatan', 'bpjs', 'puskesmas', 'rumah sakit', 'stunting', 'vaksin', 'gizi', 'dokter'],
        'Olahraga' => ['timnas', 'liga', 'sepak bola', 'bulutangkis', 'olimpiade', 'piala', 'pertandingan'],
        'Lingkungan' => ['banjir', 'hutan', 'iklim', 'sampah', 'sungai', 'lingkungan', 'bmkg', 'reboisasi'],
        'Daerah' => ['desa', 'kabupaten', 'provinsi', 'bupati', 'gubernur', 'kecamatan', 'daerah'],
    ];
    foreach ($rules as $cat => $keywords) {
        foreach ($keywords as $kw) {
            if (str_contains($text, $kw)) {
                return $cat;
            }
        }
    }
    return $defaultCat;
}

function get_demo_fallback_news(): array
{
    $now = date('c');
    return [
        [
            'id' => 'demo-news-1',
            'title' => '[Berita Contoh Offline] Percepatan Digitalisasi Pelayanan Administrasi Desa di Indonesia',
            'summary' => 'Pemerintah desa didorong mengintegrasikan tata kelola aset, peta wilayah, dan perencanaan Musrenbang secara transparan.',
            'content' => 'Konten ini ditampilkan sementara karena koneksi internet / RSS berita nasional tidak dapat dijangkau dari server XAMPP lokal Anda. Saat komputer terhubung ke internet, tekan tombol Muat Ulang Berita RSS untuk mengambil berita terkini langsung dari portal media nasional Indonesia.',
            'publishedAt' => $now,
            'source' => 'SIMPANDADU Cache (Offline)',
            'sourceUrl' => '',
            'category' => 'Nasional',
            'imageUrl' => 'assets/images/balai_desa_adimulya.jpg',
            'isDemo' => true,
        ],
        [
            'id' => 'demo-news-2',
            'title' => '[Berita Contoh Offline] Penguatan Ketahanan Pangan & Irigasi Pertanian Pedesaan',
            'summary' => 'Rehabilitasi jaringan irigasi tersier dan pemberdayaan kelompok tani menjadi prioritas dana desa tahun berjalan.',
            'content' => 'Pembangunan saluran irigasi desa serta modernisasi alat pascapanen mendukung produktivitas petani sekaligus menjaga stabilitas pasokan pangan daerah.',
            'publishedAt' => $now,
            'source' => 'SIMPANDADU Cache (Offline)',
            'sourceUrl' => '',
            'category' => 'Ekonomi',
            'imageUrl' => 'assets/images/potensi_desa_pertanian.jpg',
            'isDemo' => true,
        ],
        [
            'id' => 'demo-news-3',
            'title' => '[Berita Contoh Offline] Transparansi Musrenbang Berbasis Partisipasi Warga',
            'summary' => 'Masyarakat kini dapat mengusulkan prioritas pembangunan dan memantau status verifikasinya secara terbuka.',
            'content' => 'Partisipasi aktif warga dalam Musrenbang Desa memastikan anggaran pembangunan tepat sasaran sesuai kebutuhan riil di setiap dusun.',
            'publishedAt' => $now,
            'source' => 'SIMPANDADU Cache (Offline)',
            'sourceUrl' => '',
            'category' => 'Daerah',
            'imageUrl' => 'assets/images/login_backdrop_desa.jpg',
            'isDemo' => true,
        ],
    ];
}

function fetch_indonesian_news(bool $forceRefresh = false): array
{
    $db = get_db();
    if (!$forceRefresh) {
        $row = $db->query('SELECT * FROM news_cache WHERE id = 1 LIMIT 1')->fetch();
        if ($row && (time() - strtotime((string) $row['fetched_at'])) < 1200) {
            $decoded = json_decode((string) $row['payload_json'], true);
            if (is_array($decoded) && !empty($decoded['articles'])) {
                return $decoded;
            }
        }
    }

    $feeds = [
        ['name' => 'ANTARA News', 'url' => 'https://www.antaranews.com/rss/terkini.xml', 'defaultCat' => 'Nasional'],
        ['name' => 'CNN Indonesia', 'url' => 'https://www.cnnindonesia.com/nasional/rss', 'defaultCat' => 'Nasional'],
        ['name' => 'Tempo Nasional', 'url' => 'https://rss.tempo.co/nasional', 'defaultCat' => 'Nasional'],
        ['name' => 'ANTARA Ekonomi', 'url' => 'https://www.antaranews.com/rss/ekonomi.xml', 'defaultCat' => 'Ekonomi'],
    ];

    $articles = [];
    $sourcesChecked = [];

    foreach ($feeds as $feed) {
        $xmlString = false;
        if (function_exists('curl_init')) {
            $ch = curl_init($feed['url']);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_USERAGENT => 'SIMPANDADU-NewsAggregator/1.0',
            ]);
            $res = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($res !== false && $code >= 200 && $code < 300) {
                $xmlString = $res;
            }
        } else {
            $ctx = stream_context_create(['http' => ['timeout' => 5, 'user_agent' => 'SIMPANDADU-NewsAggregator/1.0']]);
            $xmlString = @file_get_contents($feed['url'], false, $ctx);
        }

        if (!$xmlString) {
            continue;
        }

        libxml_use_internal_errors(true);
        $xml = @simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NOCDATA);
        libxml_clear_errors();
        if (!$xml || empty($xml->channel->item)) {
            continue;
        }

        $sourcesChecked[] = $feed['name'];
        $count = 0;
        foreach ($xml->channel->item as $item) {
            if ($count >= 8) {
                break;
            }
            $title = trim(strip_tags((string) $item->title));
            $link = trim((string) $item->link);
            $rawDesc = (string) $item->description;
            $summary = trim(preg_replace('/\s+/', ' ', strip_tags($rawDesc)));
            if (mb_strlen($summary) > 220) {
                $summary = mb_substr($summary, 0, 217) . '...';
            }
            $pubDate = trim((string) $item->pubDate);
            $ts = $pubDate ? strtotime($pubDate) : time();
            $imageUrl = null;
            if (isset($item->enclosure['url']) && is_safe_http_url((string) $item->enclosure['url'])) {
                $imageUrl = (string) $item->enclosure['url'];
            } elseif (preg_match('/<img[^>]+src=["\'](https?:\/\/[^"\']+)["\']/i', $rawDesc, $m)) {
                $imageUrl = $m[1];
            }

            if ($title !== '' && is_safe_http_url($link)) {
                $articles[] = [
                    'id' => 'rss-' . substr(sha1($link), 0, 12),
                    'title' => $title,
                    'summary' => $summary ?: $title,
                    'content' => strip_tags($rawDesc) ?: $summary,
                    'publishedAt' => date('c', $ts ?: time()),
                    'source' => $feed['name'],
                    'sourceUrl' => $link,
                    'category' => classify_news_category($title, $summary, $feed['defaultCat']),
                    'imageUrl' => $imageUrl,
                    'isDemo' => false,
                ];
                $count++;
            }
        }
    }

    $isFallback = empty($articles);
    if ($isFallback) {
        $articles = get_demo_fallback_news();
    } else {
        usort($articles, static fn ($a, $b) => strcmp($b['publishedAt'], $a['publishedAt']));
    }

    $payload = [
        'articles' => $articles,
        'isDemoFallback' => $isFallback,
        'lastUpdated' => date('c'),
        'sourcesChecked' => $sourcesChecked,
    ];

    $stmt = $db->prepare(
        'INSERT INTO news_cache (id, payload_json, is_demo_fallback, fetched_at)
         VALUES (1, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), is_demo_fallback = VALUES(is_demo_fallback), fetched_at = NOW()'
    );
    $stmt->execute([json_encode($payload, JSON_UNESCAPED_UNICODE), $isFallback ? 1 : 0]);

    return $payload;
}

if (basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'news.php') {
    header('Content-Type: application/json; charset=utf-8');
    $force = !empty($_GET['refresh']);
    echo json_encode(fetch_indonesian_news($force), JSON_UNESCAPED_UNICODE);
}
