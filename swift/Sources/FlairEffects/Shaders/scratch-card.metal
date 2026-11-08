// flair-metal-hash: 7cf6eb99
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float3 uFoil;
    packed_float3 uTicket;
    int uRows;
    uint uCoin;
    uint uAuto;
    float uProgress;
    char _m19_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_scratch_card_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _170)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_170.uBackdrop) * _170.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_170.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _170)
{
    float4 _311;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _311 = overBackdrop(param, _170);
    }
    else
    {
        float2 param_1 = fract(uv);
        _311 = float4(testCard(param_1), 1.0);
    }
    return _311;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _170)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _170).xyz;
}

static inline __attribute__((always_inline))
float2 pathPoint(thread const int& i, thread const int& rows, thread const float& aspect)
{
    int row = i / 2;
    bool along = spvSMod(i, 2) == 0;
    float y = (float(row) + 0.5) / float(rows);
    bool right = spvSMod(row, 2) == 0;
    float _409;
    if (along == right)
    {
        _409 = -0.039999999105930328369140625;
    }
    else
    {
        _409 = aspect + 0.039999999105930328369140625;
    }
    float x = _409;
    return float2(x, y + ((0.039999999105930328369140625 / float(rows)) * sin(float(i) * 2.2999999523162841796875)));
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 ab = b - a;
    return length((p - a) - (ab * fast::clamp(dot(p - a, ab) / fast::max(dot(ab, ab), 9.9999999747524270787835121154785e-07), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _170, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 res = float2(_170.iResolution[0], _170.iResolution[1]);
    float t = mod(_170.iTime, 6.0);
    float _447;
    if (_170.uAuto != 0u)
    {
        _447 = fast::clamp((t - 0.4000000059604644775390625) / 3.2000000476837158203125, 0.0, 1.0);
    }
    else
    {
        _447 = _170.uProgress;
    }
    float scratched = _447;
    float _465;
    if (_170.uAuto != 0u)
    {
        _465 = smoothstep(5.19999980926513671875, 6.0, t);
    }
    else
    {
        _465 = 0.0;
    }
    float reseal = _465;
    float margin = 0.0900000035762786865234375 * fast::min(res.x, res.y);
    float2 hs = (res * 0.5) - float2(margin);
    float2 p = fragCoord - (res * 0.5);
    float panelR = 0.0599999986588954925537109375 * fast::min(hs.x, hs.y);
    float2 param = p;
    float2 param_1 = hs;
    float param_2 = panelR;
    float panel = 1.0 - smoothstep(-1.0, 1.0, roundedBox(param, param_1, param_2));
    float2 g = fragCoord / float2(res.y);
    float stripes = 0.5 + (0.5 * sin((g.x + g.y) * 60.0));
    float3 col = float3(_170.uTicket) * (0.87999999523162841796875 + (0.119999997317790985107421875 * stripes));
    float2 param_3 = p;
    float2 param_4 = hs + float2(margin * 0.3499999940395355224609375);
    float param_5 = panelR * 1.60000002384185791015625;
    col = mix(col, float3(1.0), float3(0.85000002384185791015625 * (1.0 - smoothstep(0.0, 2.0, abs(roundedBox(param_3, param_4, param_5))))));
    float aspect = hs.x / hs.y;
    float2 q = float2(p.x + hs.x, hs.y - p.y) / float2(2.0 * hs.y);
    float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
    float imageAspect = ts.x / fast::max(ts.y, 1.0);
    float2 _598;
    if (imageAspect > aspect)
    {
        _598 = float2(aspect / imageAspect, 1.0);
    }
    else
    {
        _598 = float2(1.0, imageAspect / aspect);
    }
    float2 fit = _598;
    float2 uv = float2(q.x / aspect, 1.0 - q.y);
    float2 param_6 = float2(0.5) + ((uv - float2(0.5)) * fit);
    float3 pic = picture(uImage, uImageSmplr, param_6, _170);
    int rows = clamp(_170.uRows, 2, 10);
    int segs = (rows * 2) - 1;
    float total = 0.0;
    for (int i = 0; i < 19; i++)
    {
        if (i >= segs)
        {
            break;
        }
        int param_7 = i + 1;
        int param_8 = rows;
        float param_9 = aspect;
        int param_10 = i;
        int param_11 = rows;
        float param_12 = aspect;
        total += length(pathPoint(param_7, param_8, param_9) - pathPoint(param_10, param_11, param_12));
    }
    float reach = scratched * total;
    float d = 1000.0;
    int param_13 = 0;
    int param_14 = rows;
    float param_15 = aspect;
    float2 head = pathPoint(param_13, param_14, param_15);
    float done = 0.0;
    for (int i_1 = 0; i_1 < 19; i_1++)
    {
        if ((i_1 >= segs) || (done >= reach))
        {
            break;
        }
        int param_16 = i_1;
        int param_17 = rows;
        float param_18 = aspect;
        float2 a = pathPoint(param_16, param_17, param_18);
        int param_19 = i_1 + 1;
        int param_20 = rows;
        float param_21 = aspect;
        float2 b = pathPoint(param_19, param_20, param_21);
        float len = length(b - a);
        float f = fast::clamp((reach - done) / fast::max(len, 9.9999997473787516355514526367188e-06), 0.0, 1.0);
        head = mix(a, b, float2(f));
        float2 param_22 = q;
        float2 param_23 = a;
        float2 param_24 = head;
        d = fast::min(d, segment(param_22, param_23, param_24));
        done += len;
    }
    float brush = 0.62000000476837158203125 / float(rows);
    float px = 1.0 / (2.0 * hs.y);
    float2 param_25 = q * 90.0;
    float2 param_26 = q * 14.0;
    float rough = ((vnoise(param_25) - 0.5) * 0.2199999988079071044921875) + ((vnoise(param_26) - 0.5) * 0.25);
    float edgeD = d - (brush * (1.0 + rough));
    float bare = ((1.0 - smoothstep(-px, px, edgeD)) * step(0.0005000000237487256526947021484375, scratched)) * (1.0 - reseal);
    float2 param_27 = float2(q.x * 4.0, q.y * 160.0);
    float brushed = vnoise(param_27);
    float3 foil = _170.uFoil * (0.819999992847442626953125 + (0.180000007152557373046875 * brushed));
    float sheen = exp((-powr(((q.x * 0.60000002384185791015625) - (q.y * 0.4000000059604644775390625)) - ((((fract(_170.iTime * 0.17000000178813934326171875) * 2.400000095367431640625) - 0.60000002384185791015625) * aspect) * 0.60000002384185791015625), 2.0)) * 18.0);
    foil += float3(0.2199999988079071044921875 * sheen);
    float2 param_28 = floor(fragCoord / float2(2.0));
    float2 param_29 = floor(fragCoord / float2(2.0));
    foil += float3((0.3499999940395355224609375 * step(0.99199998378753662109375, hash12(param_28))) * (0.5 + (0.5 * sin((_170.iTime * 4.0) + (hash12(param_29) * 30.0)))));
    float2 dm = abs(fract(float2(q.x + q.y, q.x - q.y) * 6.0) - float2(0.5));
    foil *= (0.959999978542327880859375 + (0.039999999105930328369140625 * smoothstep(0.4199999868869781494140625, 0.4799999892711639404296875, fast::max(dm.x, dm.y))));
    float lip = exp((-fast::max(edgeD, 0.0)) / (brush * 0.119999997317790985107421875)) * (1.0 - bare);
    foil *= (1.0 - (((0.3499999940395355224609375 * lip) * step(0.0005000000237487256526947021484375, scratched)) * (1.0 - reseal)));
    float2 param_30 = floor(fragCoord / float2(3.0));
    float fleck = (step(0.930000007152557373046875, hash12(param_30)) * (1.0 - smoothstep(0.0, brush * 0.5, edgeD))) * step(0.0, edgeD);
    foil = mix(foil, _170.uFoil * 1.25, float3((fleck * (1.0 - reseal)) * step(0.0005000000237487256526947021484375, scratched)));
    float _974;
    if (_170.uAuto != 0u)
    {
        _974 = exp((-powr((q.x - (q.y * 0.5)) - (((t - 3.7999999523162841796875) * aspect) * 1.10000002384185791015625), 2.0)) * 30.0) * step(3.599999904632568359375, t);
    }
    else
    {
        _974 = 0.0;
    }
    float shine = _974;
    float3 under = pic + float3(0.4000000059604644775390625 * shine);
    float2 param_31 = p;
    float2 param_32 = hs;
    float param_33 = panelR;
    under *= (1.0 - (0.25 * exp(roundedBox(param_31, param_32, param_33) / (margin * 0.1500000059604644775390625))));
    float3 inPanel = mix(foil, under, float3(bare));
    col = mix(col, inPanel, float3(panel));
    if ((((_170.uCoin != 0u) && (_170.uAuto != 0u)) && (scratched > 0.0)) && (scratched < 1.0))
    {
        float2 cp = ((q - head) - float2(0.0, -0.0199999995529651641845703125)) / float2(brush);
        float2 e = cp * float2(1.0, 1.60000002384185791015625);
        float r = length(e);
        float body = 1.0 - smoothstep(0.949999988079071044921875 - ((px / brush) * 2.0), 0.949999988079071044921875, r);
        float shade = 1.0 - smoothstep(0.699999988079071044921875, 1.39999997615814208984375, length((((q - head) - (float2(0.0500000007450580596923828125, 0.0599999986588954925537109375) * brush)) / float2(brush)) * float2(1.0, 1.60000002384185791015625)));
        col *= (1.0 - ((0.300000011920928955078125 * shade) * (1.0 - body)));
        float3 gold = mix(float3(0.85000002384185791015625, 0.62000000476837158203125, 0.180000007152557373046875), float3(1.0, 0.86000001430511474609375, 0.449999988079071044921875), float3(smoothstep(0.60000002384185791015625, -0.60000002384185791015625, e.x + e.y)));
        gold *= (0.85000002384185791015625 + (0.1500000059604644775390625 * smoothstep(0.7799999713897705078125, 0.699999988079071044921875, r)));
        col = mix(col, gold, float3(body));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_scratch_card_frag_out flair_scratch_card_frag(constant FlairUniforms& _170 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_scratch_card_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1145;
    if (_170.flair_flipY > 0.5)
    {
        _1145 = _170.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1145 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1145);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _170, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

