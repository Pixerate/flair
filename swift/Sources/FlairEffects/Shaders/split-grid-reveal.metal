// flair-metal-hash: 4e00a49b
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    int uCount;
    int uLayout;
    float uSlant;
    float uGap;
    float uBorder;
    char _m18_pad[12];
    packed_float3 uInk;
    float uMargin;
    float uStagger;
    float uWipe;
    float uPan;
    float uHold;
    float uSpotlight;
    char _m25_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_split_grid_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _95)
{
    float4 base = float4(float3(_95.uBackground) * _95.uBackgroundAlpha, _95.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
int2 itemSize(thread const int& i, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        return int2(uItem0.get_width(), uItem0.get_height());
    }
    if (i == 1)
    {
        return int2(uItem1.get_width(), uItem1.get_height());
    }
    if (i == 2)
    {
        return int2(uItem2.get_width(), uItem2.get_height());
    }
    if (i == 3)
    {
        return int2(uItem3.get_width(), uItem3.get_height());
    }
    if (i == 4)
    {
        return int2(uItem4.get_width(), uItem4.get_height());
    }
    return int2(uItem5.get_width(), uItem5.get_height());
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _95)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_95.uBackdrop) * _95.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_95.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _95)
{
    float4 _238;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _238 = overBackdrop(param, _95);
    }
    else
    {
        float2 param_1 = fract(uv);
        _238 = float4(testCard(param_1), 1.0);
    }
    return _238;
}

static inline __attribute__((always_inline))
float4 itemAt(thread const int& i, thread const float2& uv, constant FlairUniforms& _95, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    if (i == 0)
    {
        float2 param = uv;
        return pictureRGBA(uItem0, uItem0Smplr, param, _95);
    }
    if (i == 1)
    {
        float2 param_1 = uv;
        return pictureRGBA(uItem1, uItem1Smplr, param_1, _95);
    }
    if (i == 2)
    {
        float2 param_2 = uv;
        return pictureRGBA(uItem2, uItem2Smplr, param_2, _95);
    }
    if (i == 3)
    {
        float2 param_3 = uv;
        return pictureRGBA(uItem3, uItem3Smplr, param_3, _95);
    }
    if (i == 4)
    {
        float2 param_4 = uv;
        return pictureRGBA(uItem4, uItem4Smplr, param_4, _95);
    }
    float2 param_5 = uv;
    return pictureRGBA(uItem5, uItem5Smplr, param_5, _95);
}

static inline __attribute__((always_inline))
float4 itemCover(thread const int& i, thread float2& uv, thread const float& aspect, constant FlairUniforms& _95, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    int param = i;
    int2 ts = itemSize(param, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    bool _452 = ts.x > 1;
    bool _458;
    if (_452)
    {
        _458 = ts.y > 1;
    }
    else
    {
        _458 = _452;
    }
    if (_458)
    {
        float ta = float(ts.x) / float(ts.y);
        if (ta > aspect)
        {
            uv.x = (((uv.x - 0.5) * aspect) / ta) + 0.5;
        }
        else
        {
            uv.y = (((uv.y - 0.5) * ta) / aspect) + 0.5;
        }
    }
    int param_1 = i;
    float2 param_2 = uv;
    return itemAt(param_1, param_2, _95, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
}

static inline __attribute__((always_inline))
float4 spotlight(thread const float& t, thread const float& start, thread const float& hold, thread const int& n)
{
    float c = (t - start) / fast::max(hold, 0.100000001490116119384765625);
    if ((c < 0.0) || (n < 1))
    {
        return float4(-1.0, 0.0, -1.0, 0.0);
    }
    float k = floor(c);
    float param = ((c - k) * hold) / 0.449999988079071044921875;
    float _530 = ease(param);
    float w = _530;
    float h = mod(k, float(n));
    float _539;
    if (k >= 1.0)
    {
        _539 = mod(k - 1.0, float(n));
    }
    else
    {
        _539 = -1.0;
    }
    float prev = _539;
    return float4(h, w, prev, 1.0 - w);
}

static inline __attribute__((always_inline))
float spotWeight(thread const float4& s, thread const int& i)
{
    float _562;
    if (int(s.x) == i)
    {
        _562 = s.y;
    }
    else
    {
        _562 = 0.0;
    }
    float _575;
    if (int(s.z) == i)
    {
        _575 = s.w;
    }
    else
    {
        _575 = 0.0;
    }
    return _562 + _575;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _95, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr, texture2d<float> uItem5, sampler uItem5Smplr)
{
    float aspect = _95.iResolution[0u] / _95.iResolution[1u];
    float px = 1.0 / _95.iResolution[1u];
    int n = clamp(_95.uCount, 1, 6);
    float fn = float(n);
    float2 box = float2(aspect - (2.0 * _95.uMargin), 1.0 - (2.0 * _95.uMargin));
    float2 u = ((fragCoord / float2(_95.iResolution[1u])) - float2(_95.uMargin)) / box;
    float4 acc = float4(0.0);
    bool _633 = box.x <= 0.0;
    bool _640;
    if (!_633)
    {
        _640 = box.y <= 0.0;
    }
    else
    {
        _640 = _633;
    }
    bool _649;
    if (!_640)
    {
        _649 = any(u < float2(0.0));
    }
    else
    {
        _649 = _640;
    }
    bool _657;
    if (!_649)
    {
        _657 = any(u > float2(1.0));
    }
    else
    {
        _657 = _649;
    }
    if (_657)
    {
        float4 param = acc;
        fragColor = finish(param, _95);
        return;
    }
    bool across = false;
    int i;
    float2 l;
    float2 size;
    if ((_95.uLayout == 1) && (n > 1))
    {
        int topCount = (n + 1) / 2;
        bool top = u.y > 0.5;
        int _686;
        if (top)
        {
            _686 = topCount;
        }
        else
        {
            _686 = n - topCount;
        }
        int k = _686;
        float xs = u.x + (((fract(u.y * 2.0) - 0.5) * _95.uSlant) * 0.5);
        float col = fast::clamp(floor(xs * float(k)), 0.0, float(k - 1));
        i = (top ? 0 : topCount) + int(col);
        l = float2((xs * float(k)) - col, fract(u.y * 2.0));
        size = box * float2(1.0 / float(k), 0.5);
    }
    else
    {
        if (_95.uLayout == 2)
        {
            float ys = u.y + ((u.x - 0.5) * _95.uSlant);
            float row = fast::clamp(floor(ys * fn), 0.0, fn - 1.0);
            i = (n - 1) - int(row);
            l = float2(u.x, (ys * fn) - row);
            size = box * float2(1.0, 1.0 / fn);
            across = true;
        }
        else
        {
            float xs_1 = u.x + ((u.y - 0.5) * _95.uSlant);
            float col_1 = fast::clamp(floor(xs_1 * fn), 0.0, fn - 1.0);
            i = int(col_1);
            l = float2((xs_1 * fn) - col_1, u.y);
            size = box * float2(1.0 / fn, 1.0);
        }
    }
    float2 toEdge = fast::min(l, float2(1.0) - l) * size;
    float e = fast::min(toEdge.x, toEdge.y);
    float inside = smoothstep((0.5 * _95.uGap) - px, (0.5 * _95.uGap) + px, e);
    float _855;
    if (_95.uBorder > 0.0)
    {
        _855 = smoothstep(((0.5 * _95.uGap) + _95.uBorder) + px, ((0.5 * _95.uGap) + _95.uBorder) - px, e) * inside;
    }
    else
    {
        _855 = 0.0;
    }
    float ink = _855;
    float start = 0.20000000298023223876953125 + (_95.uStagger * float(i));
    float param_1 = (_95.iTime - start) / _95.uWipe;
    float _899 = ease(param_1);
    float r = _899;
    bool flip = mod(float(i), 2.0) > 0.5;
    float _907;
    if (across)
    {
        _907 = l.x;
    }
    else
    {
        _907 = l.y;
    }
    float along = _907;
    float _918;
    if (flip)
    {
        _918 = along;
    }
    else
    {
        _918 = 1.0 - along;
    }
    float edge = _918;
    float shown = smoothstep(r * 1.0499999523162841796875, (r * 1.0499999523162841796875) - 0.0500000007450580596923828125, 1.0 - edge) * step(0.001000000047497451305389404296875, r);
    float2 _943;
    if (across)
    {
        _943 = float2(flip ? (-1.0) : 1.0, 0.0);
    }
    else
    {
        _943 = float2(0.0, flip ? (-1.0) : 1.0);
    }
    float2 slide = (_943 * 0.119999997317790985107421875) * (1.0 - r);
    float t = fast::max(_95.iTime - start, 0.0);
    float2 drift = float2(sin((t * 0.20999999344348907470703125) + (float(i) * 1.7000000476837158203125)), cos((t * 0.17000000178813934326171875) + (float(i) * 2.2999999523162841796875))) * (_95.uPan * 0.0350000001490116119384765625);
    float2 puv = ((((l - float2(0.5)) + slide) * (1.0 - (0.0900000035762786865234375 * _95.uPan))) + float2(0.5)) + drift;
    int param_2 = i;
    float2 param_3 = puv;
    float param_4 = size.x / size.y;
    float4 _1017 = itemCover(param_2, param_3, param_4, _95, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    float4 pic = _1017;
    float settled = ((0.20000000298023223876953125 + (_95.uStagger * (fn - 1.0))) + _95.uWipe) + 0.60000002384185791015625;
    float param_5 = _95.iTime;
    float param_6 = settled;
    float param_7 = _95.uHold;
    int param_8 = n;
    float4 s = spotlight(param_5, param_6, param_7, param_8);
    float4 param_9 = s;
    int param_10 = i;
    float off = (_95.uSpotlight * fast::clamp((_95.iTime - settled) / 0.449999988079071044921875, 0.0, 1.0)) * (1.0 - spotWeight(param_9, param_10));
    float3 col_2 = mix(pic.xyz, float3(dot(pic.xyz, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625))) * 0.449999988079071044921875, float3(off));
    float4 param_11 = acc;
    float3 param_12 = col_2;
    float param_13 = (inside * shown) * pic.w;
    acc = over(param_11, param_12, param_13);
    float4 param_14 = acc;
    float3 param_15 = float3(_95.uInk);
    float param_16 = ink * shown;
    acc = over(param_14, param_15, param_16);
    float4 param_17 = acc;
    fragColor = finish(param_17, _95);
}

fragment flair_split_grid_reveal_frag_out flair_split_grid_reveal_frag(constant FlairUniforms& _95 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], texture2d<float> uItem5 [[texture(6)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], sampler uItem5Smplr [[sampler(6)]], float4 gl_FragCoord [[position]])
{
    flair_split_grid_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1114;
    if (_95.flair_flipY > 0.5)
    {
        _1114 = _95.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1114 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1114);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _95, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr, uItem5, uItem5Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

