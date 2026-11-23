// flair-metal-hash: a28beccd
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    int uDevice;
    int uTransition;
    uint uAnimate;
    float uProgress;
    float uSize;
    float uFloat;
    char _m19_pad[8];
    packed_float3 uBezel;
    float uShadow;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_screenshot_carousel_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 deviceSize(thread const int& k)
{
    float2 _292;
    if (k == 0)
    {
        _292 = float2(0.4900000095367431640625, 1.0);
    }
    else
    {
        float2 _300;
        if (k == 1)
        {
            _300 = float2(0.7599999904632568359375, 1.0);
        }
        else
        {
            float2 _309;
            if (k == 2)
            {
                _309 = float2(1.559999942779541015625, 1.0);
            }
            else
            {
                float2 _318;
                if (k == 3)
                {
                    _318 = float2(1.5, 1.0);
                }
                else
                {
                    _318 = select(float2(1.5, 1.0), float2(0.62000000476837158203125, 1.0), bool2(k == 4));
                }
                _309 = _318;
            }
            _300 = _309;
        }
        _292 = _300;
    }
    return _292;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 deviceScreen(thread const int& k)
{
    float4 _339;
    if (k == 0)
    {
        _339 = float4(0.0, 0.0, 0.2249999940395355224609375, 0.4799999892711639404296875);
    }
    else
    {
        float4 _347;
        if (k == 1)
        {
            _347 = float4(0.0, 0.0, 0.3449999988079071044921875, 0.4650000035762786865234375);
        }
        else
        {
            float4 _356;
            if (k == 2)
            {
                _356 = float4(0.0, 0.0599999986588954925537109375, 0.62000000476837158203125, 0.38999998569488525390625);
            }
            else
            {
                float4 _364;
                if (k == 3)
                {
                    _364 = float4(0.0, 0.119999997317790985107421875, 0.699999988079071044921875, 0.36000001430511474609375);
                }
                else
                {
                    _364 = select(float4(0.0, -0.0350000001490116119384765625, 0.730000019073486328125, 0.444999992847442626953125), float4(0.0, 0.0, 0.2199999988079071044921875, 0.2700000107288360595703125), bool4(k == 4));
                }
                _356 = _364;
            }
            _347 = _356;
        }
        _339 = _347;
    }
    return _339;
}

static inline __attribute__((always_inline))
float dsBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float deviceScreenRadius(thread const int& k)
{
    float _390;
    if (k == 0)
    {
        _390 = 0.054999999701976776123046875;
    }
    else
    {
        float _397;
        if (k == 1)
        {
            _397 = 0.02999999932944774627685546875;
        }
        else
        {
            _397 = (k == 4) ? 0.0900000035762786865234375 : 0.008000000379979610443115234375;
        }
        _390 = _397;
    }
    return _390;
}

static inline __attribute__((always_inline))
float4 deviceFrame(thread const int& k, thread const float2& p, thread const float3& bezel, thread const float& px, thread float2& suv, thread float& screen)
{
    int param = k;
    float2 sz = deviceSize(param) * 0.5;
    int param_1 = k;
    float4 sr = deviceScreen(param_1);
    float3 c = bezel;
    float body;
    if (k == 2)
    {
        float2 param_2 = p - float2(0.0, 0.0599999986588954925537109375);
        float2 param_3 = float2(0.660000026226043701171875, 0.430000007152557373046875);
        float param_4 = 0.02999999932944774627685546875;
        float lid = dsBox(param_2, param_3, param_4);
        float2 param_5 = p - float2(0.0, -0.4199999868869781494140625);
        float2 param_6 = float2(0.7799999713897705078125, 0.0350000001490116119384765625);
        float param_7 = 0.0199999995529651641845703125;
        float base = dsBox(param_5, param_6, param_7);
        body = fast::min(lid, base);
        c = mix(bezel, (bezel * 0.75) + float3(0.180000007152557373046875), float3(step(p.y, -0.3849999904632568359375)));
    }
    else
    {
        if (k == 3)
        {
            float2 param_8 = p - float2(0.0, 0.119999997317790985107421875);
            float2 param_9 = float2(0.7400000095367431640625, 0.4000000059604644775390625);
            float param_10 = 0.0199999995529651641845703125;
            float scr = dsBox(param_8, param_9, param_10);
            float2 param_11 = p - float2(0.0, -0.36000001430511474609375);
            float2 param_12 = float2(0.0599999986588954925537109375, 0.100000001490116119384765625);
            float param_13 = 0.0;
            float neck = dsBox(param_11, param_12, param_13);
            float2 param_14 = p - float2(0.0, -0.4699999988079071044921875);
            float2 param_15 = float2(0.2199999988079071044921875, 0.02500000037252902984619140625);
            float param_16 = 0.0199999995529651641845703125;
            float foot = dsBox(param_14, param_15, param_16);
            body = fast::min(scr, fast::min(neck, foot));
        }
        else
        {
            if (k == 4)
            {
                float2 param_17 = p;
                float2 param_18 = float2(0.2700000107288360595703125, 0.3300000131130218505859375);
                float param_19 = 0.119999997317790985107421875;
                float2 param_20 = p;
                float2 param_21 = float2(0.189999997615814208984375, 0.5);
                float param_22 = 0.0500000007450580596923828125;
                body = fast::min(dsBox(param_17, param_18, param_19), dsBox(param_20, param_21, param_22));
            }
            else
            {
                float _534;
                if (k == 0)
                {
                    _534 = 0.07500000298023223876953125;
                }
                else
                {
                    _534 = (k == 1) ? 0.04500000178813934326171875 : 0.02999999932944774627685546875;
                }
                float2 param_23 = p;
                float2 param_24 = sz;
                float param_25 = _534;
                body = dsBox(param_23, param_24, param_25);
            }
        }
    }
    int param_26 = k;
    float2 param_27 = p - sr.xy;
    float2 param_28 = sr.zw;
    float param_29 = deviceScreenRadius(param_26);
    float sd = dsBox(param_27, param_28, param_29);
    screen = smoothstep(px, -px, sd);
    suv = ((p - sr.xy) / (sr.zw * 2.0)) + float2(0.5);
    if (k == 5)
    {
        c = mix(c, (bezel * 1.2000000476837158203125) + float3(0.07999999821186065673828125), float3(step(sr.y + sr.w, p.y)));
        for (int i = 0; i < 3; i++)
        {
            float2 dotAt = float2(((-sz.x) + 0.0500000007450580596923828125) + (0.0350000001490116119384765625 * float(i)), sz.y - 0.04500000178813934326171875);
            c = mix(c, float3(0.949999988079071044921875, 0.4000000059604644775390625 + (0.20000000298023223876953125 * float(i)), 0.3499999940395355224609375), float3(smoothstep(px, -px, length(p - dotAt) - 0.010999999940395355224609375)));
        }
    }
    if (k == 0)
    {
        float2 param_30 = p - float2(0.0, (sr.y + sr.w) - 0.02999999932944774627685546875);
        float2 param_31 = float2(0.0500000007450580596923828125, 0.01200000010430812835693359375);
        float param_32 = 0.01200000010430812835693359375;
        screen *= smoothstep(-px, px, dsBox(param_30, param_31, param_32));
    }
    return float4(c, smoothstep(px, -px, body));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _102)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_102.uBackdrop) * _102.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_102.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _102)
{
    float4 _246;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _246 = overBackdrop(param, _102);
    }
    else
    {
        float2 param_1 = fract(uv);
        _246 = float4(testCard(param_1), 1.0);
    }
    return _246;
}

static inline __attribute__((always_inline))
float4 screenRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& suv, thread const float& aspect, constant FlairUniforms& _102)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    float2 uv = suv;
    bool _765 = ts.x > 1;
    bool _771;
    if (_765)
    {
        _771 = ts.y > 1;
    }
    else
    {
        _771 = _765;
    }
    if (_771)
    {
        float texAspect = float(ts.x) / float(ts.y);
        if (texAspect > aspect)
        {
            uv.x = (((suv.x - 0.5) * aspect) / texAspect) + 0.5;
        }
        else
        {
            uv.y = 1.0 - (((1.0 - suv.y) * texAspect) / aspect);
        }
    }
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _102);
}

static inline __attribute__((always_inline))
float4 swapScreen(thread const float2& suv, thread const float& aspect, thread float& t, constant FlairUniforms& _102, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    t = smoothstep(0.0, 1.0, fast::clamp(t, 0.0, 1.0));
    if (_102.uTransition == 1)
    {
        float2 param = suv;
        float param_1 = aspect;
        float2 param_2 = suv;
        float param_3 = aspect;
        return mix(screenRGBA(uFrom, uFromSmplr, param, param_1, _102), screenRGBA(uTo, uToSmplr, param_2, param_3, _102), float4(t));
    }
    if (_102.uTransition == 2)
    {
        float2 param_4 = ((suv - float2(0.5)) / float2(1.0 + (0.25 * t))) + float2(0.5);
        float param_5 = aspect;
        float4 a = screenRGBA(uFrom, uFromSmplr, param_4, param_5, _102);
        float2 param_6 = ((suv - float2(0.5)) / float2(0.85000002384185791015625 + (0.1500000059604644775390625 * t))) + float2(0.5);
        float param_7 = aspect;
        float4 b = screenRGBA(uTo, uToSmplr, param_6, param_7, _102);
        return mix(a, b, float4(t));
    }
    if (_102.uTransition == 3)
    {
        float edge = smoothstep((t * 1.2000000476837158203125) - 0.100000001490116119384765625, (t * 1.2000000476837158203125) - 0.20000000298023223876953125, suv.x);
        float2 param_8 = suv;
        float param_9 = aspect;
        float2 param_10 = suv;
        float param_11 = aspect;
        return mix(screenRGBA(uFrom, uFromSmplr, param_8, param_9, _102), screenRGBA(uTo, uToSmplr, param_10, param_11, _102), float4(edge));
    }
    float2 sa = suv + float2(t, 0.0);
    float2 sb = suv + float2(t - 1.0, 0.0);
    float4 _923;
    if (sa.x <= 1.0)
    {
        float2 param_12 = sa;
        float param_13 = aspect;
        _923 = screenRGBA(uFrom, uFromSmplr, param_12, param_13, _102);
    }
    else
    {
        float2 param_14 = sb;
        float param_15 = aspect;
        _923 = screenRGBA(uTo, uToSmplr, param_14, param_15, _102);
    }
    return _923;
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _102)
{
    float4 base = float4(float3(_102.uBackground) * _102.uBackgroundAlpha, _102.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _102, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float h = _102.iResolution[1u] * _102.uSize;
    int k = clamp(_102.uDevice, 0, 5);
    int param = k;
    h = fast::min(h, (_102.iResolution[0u] * _102.uSize) / deviceSize(param).x);
    float2 p = (fragCoord - (float2(_102.iResolution[0], _102.iResolution[1]) * 0.5)) / float2(h);
    float px = 1.5 / h;
    float _983;
    if (_102.uAnimate != 0u)
    {
        _983 = smoothstep(0.3499999940395355224609375, 0.5, ((abs(fract(_102.iTime / 6.0) - 0.5) * 2.0) * 0.5) + 0.25);
    }
    else
    {
        _983 = _102.uProgress;
    }
    float t = _983;
    float bob = (_102.uFloat * 0.0199999995529651641845703125) * sin((_102.iTime * 6.28318023681640625) / 6.0);
    float2 q = p - float2(0.0, bob);
    float4 acc = float4(0.0);
    int param_1 = k;
    float shadow = exp((-powr(length((q - float2(0.0, -0.560000002384185791015625)) * float2(1.0 / deviceSize(param_1).x, 7.0)), 2.0)) * 2.0);
    float4 param_2 = acc;
    float3 param_3 = float3(0.0);
    float param_4 = (shadow * _102.uShadow) * 0.60000002384185791015625;
    acc = over(param_2, param_3, param_4);
    int param_5 = k;
    float2 param_6 = q;
    float3 param_7 = float3(_102.uBezel);
    float param_8 = px;
    float2 param_9;
    float param_10;
    float4 _1067 = deviceFrame(param_5, param_6, param_7, param_8, param_9, param_10);
    float2 suv = param_9;
    float screen = param_10;
    float4 frame = _1067;
    float4 param_11 = acc;
    float3 param_12 = frame.xyz;
    float param_13 = frame.w;
    acc = over(param_11, param_12, param_13);
    if (screen > 0.0)
    {
        int param_14 = k;
        float4 sr = deviceScreen(param_14);
        float2 param_15 = suv;
        float param_16 = sr.z / sr.w;
        float param_17 = t;
        float4 _1099 = swapScreen(param_15, param_16, param_17, _102, uFrom, uFromSmplr, uTo, uToSmplr);
        float4 shot = _1099;
        float4 param_18 = acc;
        float3 param_19 = shot.xyz;
        float param_20 = screen * shot.w;
        acc = over(param_18, param_19, param_20);
    }
    float4 param_21 = acc;
    fragColor = finish(param_21, _102);
}

fragment flair_screenshot_carousel_frag_out flair_screenshot_carousel_frag(constant FlairUniforms& _102 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_screenshot_carousel_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1125;
    if (_102.flair_flipY > 0.5)
    {
        _1125 = _102.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1125 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1125);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _102, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

