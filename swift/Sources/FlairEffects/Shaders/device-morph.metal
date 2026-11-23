// flair-metal-hash: 43407c48
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
    int uDevice0;
    int uDevice1;
    int uDevice2;
    int uDevice3;
    int uCount;
    float uHold;
    float uMorph;
    float uSize;
    float uFloat;
    char _m22_pad[12];
    packed_float3 uBezel;
    float uShadow;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_device_morph_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float ease(thread float& t)
{
    t = fast::clamp(t, 0.0, 1.0);
    return (t * t) * (3.0 - (2.0 * t));
}

static inline __attribute__((always_inline))
int deviceOf(thread const int& i, constant FlairUniforms& _114)
{
    int _608;
    if (i == 0)
    {
        _608 = _114.uDevice0;
    }
    else
    {
        int _618;
        if (i == 1)
        {
            _618 = _114.uDevice1;
        }
        else
        {
            int _627;
            if (i == 2)
            {
                _627 = _114.uDevice2;
            }
            else
            {
                _627 = _114.uDevice3;
            }
            _618 = _627;
        }
        _608 = _618;
    }
    return clamp(_608, 0, 5);
}

static inline __attribute__((always_inline))
float2 deviceSize(thread const int& k)
{
    float2 _304;
    if (k == 0)
    {
        _304 = float2(0.4900000095367431640625, 1.0);
    }
    else
    {
        float2 _312;
        if (k == 1)
        {
            _312 = float2(0.7599999904632568359375, 1.0);
        }
        else
        {
            float2 _321;
            if (k == 2)
            {
                _321 = float2(1.559999942779541015625, 1.0);
            }
            else
            {
                float2 _330;
                if (k == 3)
                {
                    _330 = float2(1.5, 1.0);
                }
                else
                {
                    _330 = select(float2(1.5, 1.0), float2(0.62000000476837158203125, 1.0), bool2(k == 4));
                }
                _321 = _330;
            }
            _312 = _321;
        }
        _304 = _312;
    }
    return _304;
}

static inline __attribute__((always_inline))
float4 bodyBox(thread const int& k)
{
    float4 _646;
    if (k == 2)
    {
        _646 = float4(0.0, 0.0599999986588954925537109375, 0.660000026226043701171875, 0.430000007152557373046875);
    }
    else
    {
        float4 _655;
        if (k == 3)
        {
            _655 = float4(0.0, 0.119999997317790985107421875, 0.7400000095367431640625, 0.4000000059604644775390625);
        }
        else
        {
            float4 _664;
            if (k == 4)
            {
                _664 = float4(0.0, 0.0, 0.2700000107288360595703125, 0.3300000131130218505859375);
            }
            else
            {
                int param = k;
                _664 = float4(0.0, 0.0, 0.5 * deviceSize(param).x, 0.5);
            }
            _655 = _664;
        }
        _646 = _655;
    }
    return _646;
}

static inline __attribute__((always_inline))
float bodyRadius(thread const int& k)
{
    float _683;
    if (k == 0)
    {
        _683 = 0.07500000298023223876953125;
    }
    else
    {
        float _690;
        if (k == 1)
        {
            _690 = 0.04500000178813934326171875;
        }
        else
        {
            float _697;
            if (k == 4)
            {
                _697 = 0.119999997317790985107421875;
            }
            else
            {
                _697 = (k == 3) ? 0.0199999995529651641845703125 : 0.02999999932944774627685546875;
            }
            _690 = _697;
        }
        _683 = _690;
    }
    return _683;
}

static inline __attribute__((always_inline))
float4 deviceScreen(thread const int& k)
{
    float4 _351;
    if (k == 0)
    {
        _351 = float4(0.0, 0.0, 0.2249999940395355224609375, 0.4799999892711639404296875);
    }
    else
    {
        float4 _359;
        if (k == 1)
        {
            _359 = float4(0.0, 0.0, 0.3449999988079071044921875, 0.4650000035762786865234375);
        }
        else
        {
            float4 _368;
            if (k == 2)
            {
                _368 = float4(0.0, 0.0599999986588954925537109375, 0.62000000476837158203125, 0.38999998569488525390625);
            }
            else
            {
                float4 _376;
                if (k == 3)
                {
                    _376 = float4(0.0, 0.119999997317790985107421875, 0.699999988079071044921875, 0.36000001430511474609375);
                }
                else
                {
                    _376 = select(float4(0.0, -0.0350000001490116119384765625, 0.730000019073486328125, 0.444999992847442626953125), float4(0.0, 0.0, 0.2199999988079071044921875, 0.2700000107288360595703125), bool4(k == 4));
                }
                _368 = _376;
            }
            _359 = _368;
        }
        _351 = _359;
    }
    return _351;
}

static inline __attribute__((always_inline))
float deviceScreenRadius(thread const int& k)
{
    float _402;
    if (k == 0)
    {
        _402 = 0.054999999701976776123046875;
    }
    else
    {
        float _409;
        if (k == 1)
        {
            _409 = 0.02999999932944774627685546875;
        }
        else
        {
            _409 = (k == 4) ? 0.0900000035762786865234375 : 0.008000000379979610443115234375;
        }
        _402 = _409;
    }
    return _402;
}

static inline __attribute__((always_inline))
float share(thread const int& want, thread const int& a, thread const int& b, thread const float& m)
{
    float _713;
    if (a == want)
    {
        _713 = 1.0 - m;
    }
    else
    {
        _713 = 0.0;
    }
    return _713 + ((b == want) ? m : 0.0);
}

static inline __attribute__((always_inline))
float dsBox(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _114)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_114.uBackdrop) * _114.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_114.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _114)
{
    float4 _258;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _258 = overBackdrop(param, _114);
    }
    else
    {
        float2 param_1 = fract(uv);
        _258 = float4(testCard(param_1), 1.0);
    }
    return _258;
}

static inline __attribute__((always_inline))
float4 screenRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& suv, thread const float& aspect, constant FlairUniforms& _114)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    float2 uv = suv;
    bool _506 = ts.x > 1;
    bool _512;
    if (_506)
    {
        _512 = ts.y > 1;
    }
    else
    {
        _512 = _506;
    }
    if (_512)
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
    return pictureRGBA(tex, texSmplr, param, _114);
}

static inline __attribute__((always_inline))
float4 shot(thread const int& i, thread const float2& suv, thread const float& aspect, constant FlairUniforms& _114, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr)
{
    if (i == 0)
    {
        float2 param = suv;
        float param_1 = aspect;
        return screenRGBA(uItem0, uItem0Smplr, param, param_1, _114);
    }
    if (i == 1)
    {
        float2 param_2 = suv;
        float param_3 = aspect;
        return screenRGBA(uItem1, uItem1Smplr, param_2, param_3, _114);
    }
    if (i == 2)
    {
        float2 param_4 = suv;
        float param_5 = aspect;
        return screenRGBA(uItem2, uItem2Smplr, param_4, param_5, _114);
    }
    float2 param_6 = suv;
    float param_7 = aspect;
    return screenRGBA(uItem3, uItem3Smplr, param_6, param_7, _114);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _114)
{
    float4 base = float4(float3(_114.uBackground) * _114.uBackgroundAlpha, _114.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _114, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr)
{
    int n = clamp(_114.uCount, 1, 4);
    float c = _114.iTime / fast::max(_114.uHold, 0.100000001490116119384765625);
    float k = floor(c);
    float f = c - k;
    int from = int(mod(k, float(n)));
    int to = int(mod(k + 1.0, float(n)));
    float _765;
    if (n > 1)
    {
        float param = (f - (1.0 - _114.uMorph)) / _114.uMorph;
        float _778 = ease(param);
        _765 = _778;
    }
    else
    {
        _765 = 0.0;
    }
    float m = _765;
    int param_1 = from;
    int a = deviceOf(param_1, _114);
    int param_2 = to;
    int b = deviceOf(param_2, _114);
    int param_3 = a;
    float fitA = fast::min(_114.iResolution[1u] * _114.uSize, (_114.iResolution[0u] * _114.uSize) / deviceSize(param_3).x);
    int param_4 = b;
    float fitB = fast::min(_114.iResolution[1u] * _114.uSize, (_114.iResolution[0u] * _114.uSize) / deviceSize(param_4).x);
    float h = mix(fitA, fitB, m);
    float2 p = (fragCoord - (float2(_114.iResolution[0], _114.iResolution[1]) * 0.5)) / float2(h);
    float px = 1.5 / h;
    p.y -= ((_114.uFloat * 0.0199999995529651641845703125) * sin(_114.iTime * 1.2999999523162841796875));
    int param_5 = a;
    float4 bodyA = bodyBox(param_5);
    int param_6 = b;
    float4 bodyB = bodyBox(param_6);
    float4 body = mix(bodyA, bodyB, float4(m));
    int param_7 = a;
    int param_8 = b;
    float radius = mix(bodyRadius(param_7), bodyRadius(param_8), m);
    int param_9 = a;
    int param_10 = b;
    float4 sr = mix(deviceScreen(param_9), deviceScreen(param_10), float4(m));
    int param_11 = a;
    int param_12 = b;
    float sRadius = mix(deviceScreenRadius(param_11), deviceScreenRadius(param_12), m);
    int param_13 = 2;
    int param_14 = a;
    int param_15 = b;
    float param_16 = m;
    float laptop = share(param_13, param_14, param_15, param_16);
    int param_17 = 3;
    int param_18 = a;
    int param_19 = b;
    float param_20 = m;
    float desktop = share(param_17, param_18, param_19, param_20);
    int param_21 = 4;
    int param_22 = a;
    int param_23 = b;
    float param_24 = m;
    float watch = share(param_21, param_22, param_23, param_24);
    int param_25 = 5;
    int param_26 = a;
    int param_27 = b;
    float param_28 = m;
    float browser = share(param_25, param_26, param_27, param_28);
    int param_29 = 0;
    int param_30 = a;
    int param_31 = b;
    float param_32 = m;
    float phone = share(param_29, param_30, param_31, param_32);
    float2 param_33 = p - body.xy;
    float2 param_34 = body.zw;
    float param_35 = radius;
    float d = dsBox(param_33, param_34, param_35);
    float2 param_36 = p - float2(0.0, -0.4199999868869781494140625);
    float2 param_37 = float2(0.7799999713897705078125 * laptop, 0.0350000001490116119384765625);
    float param_38 = 0.0199999995529651641845703125;
    float base = dsBox(param_36, param_37, param_38);
    float2 param_39 = p - float2(0.0, -0.36000001430511474609375);
    float2 param_40 = float2(0.0599999986588954925537109375, 0.100000001490116119384765625 * desktop);
    float param_41 = 0.0;
    float2 param_42 = p - float2(0.0, -0.4699999988079071044921875);
    float2 param_43 = float2(0.2199999988079071044921875 * desktop, 0.02500000037252902984619140625);
    float param_44 = 0.0199999995529651641845703125;
    float neck = fast::min(dsBox(param_39, param_40, param_41), dsBox(param_42, param_43, param_44));
    float2 param_45 = p;
    float2 param_46 = float2(0.189999997615814208984375, 0.5 * watch);
    float param_47 = 0.0500000007450580596923828125;
    float strap = dsBox(param_45, param_46, param_47);
    float4 acc = float4(0.0);
    float bottom = mix(-0.5, -0.449999988079071044921875, fast::max(laptop, desktop));
    float shadow = exp((-powr(length((p - float2(0.0, bottom - 0.0599999986588954925537109375)) * float2(1.0 / fast::max(2.0 * body.z, 0.4000000059604644775390625), 7.0)), 2.0)) * 2.0);
    float4 param_48 = acc;
    float3 param_49 = float3(0.0);
    float param_50 = (shadow * _114.uShadow) * 0.60000002384185791015625;
    acc = over(param_48, param_49, param_50);
    float4 param_51 = acc;
    float3 param_52 = float3(_114.uBezel) * 0.800000011920928955078125;
    float param_53 = smoothstep(px, -px, strap) * watch;
    acc = over(param_51, param_52, param_53);
    float4 param_54 = acc;
    float3 param_55 = float3(_114.uBezel);
    float param_56 = smoothstep(px, -px, neck) * desktop;
    acc = over(param_54, param_55, param_56);
    float4 param_57 = acc;
    float3 param_58 = (float3(_114.uBezel) * 0.75) + float3(0.180000007152557373046875);
    float param_59 = smoothstep(px, -px, base) * laptop;
    acc = over(param_57, param_58, param_59);
    float3 col = float3(_114.uBezel);
    col = mix(col, (float3(_114.uBezel) * 1.2000000476837158203125) + float3(0.07999999821186065673828125), float3(browser * step(sr.y + sr.w, p.y)));
    float4 param_60 = acc;
    float3 param_61 = col;
    float param_62 = smoothstep(px, -px, d);
    acc = over(param_60, param_61, param_62);
    if (browser > 0.0)
    {
        for (int i = 0; i < 3; i++)
        {
            float2 dotAt = float2(((-body.z) + 0.0500000007450580596923828125) + (0.0350000001490116119384765625 * float(i)), (body.y + body.w) - 0.04500000178813934326171875);
            float4 param_63 = acc;
            float3 param_64 = float3(0.949999988079071044921875, 0.4000000059604644775390625 + (0.20000000298023223876953125 * float(i)), 0.3499999940395355224609375);
            float param_65 = smoothstep(px, -px, length(p - dotAt) - 0.010999999940395355224609375) * browser;
            acc = over(param_63, param_64, param_65);
        }
    }
    float2 param_66 = p - sr.xy;
    float2 param_67 = sr.zw;
    float param_68 = sRadius;
    float screen = smoothstep(px, -px, dsBox(param_66, param_67, param_68));
    float2 param_69 = p - float2(0.0, (sr.y + sr.w) - 0.02999999932944774627685546875);
    float2 param_70 = float2(0.0500000007450580596923828125, 0.01200000010430812835693359375);
    float param_71 = 0.01200000010430812835693359375;
    screen *= (1.0 - (phone * smoothstep(-px, px, -dsBox(param_69, param_70, param_71))));
    if (screen > 0.0)
    {
        float2 suv = ((p - sr.xy) / (sr.zw * 2.0)) + float2(0.5);
        float aspect = sr.z / sr.w;
        float swap_ = smoothstep(0.3499999940395355224609375, 0.64999997615814208984375, m);
        float4 _1253;
        if (swap_ < 1.0)
        {
            int param_72 = from;
            float2 param_73 = suv;
            float param_74 = aspect;
            _1253 = shot(param_72, param_73, param_74, _114, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr);
        }
        else
        {
            _1253 = float4(0.0);
        }
        float4 s = _1253;
        if (swap_ > 0.0)
        {
            int param_75 = to;
            float2 param_76 = suv;
            float param_77 = aspect;
            s = mix(s, shot(param_75, param_76, param_77, _114, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr), float4(swap_));
        }
        float4 param_78 = acc;
        float3 param_79 = s.xyz;
        float param_80 = screen * s.w;
        acc = over(param_78, param_79, param_80);
    }
    float4 param_81 = acc;
    fragColor = finish(param_81, _114);
}

fragment flair_device_morph_frag_out flair_device_morph_frag(constant FlairUniforms& _114 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], float4 gl_FragCoord [[position]])
{
    flair_device_morph_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1305;
    if (_114.flair_flipY > 0.5)
    {
        _1305 = _114.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1305 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1305);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _114, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

