// flair-metal-hash: d08c6f62
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    int uDevice4;
    int uCount;
    int uLayout;
    float uSize;
    float uOrbit;
    float uSpeed;
    char _m23_pad[8];
    packed_float3 uBezel;
    float uShadow;
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_device_showcase_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
int deviceOf(thread const int& i, constant FlairUniforms& _117)
{
    int _880;
    if (i == 0)
    {
        _880 = _117.uDevice0;
    }
    else
    {
        int _890;
        if (i == 1)
        {
            _890 = _117.uDevice1;
        }
        else
        {
            int _899;
            if (i == 2)
            {
                _899 = _117.uDevice2;
            }
            else
            {
                int _908;
                if (i == 3)
                {
                    _908 = _117.uDevice3;
                }
                else
                {
                    _908 = _117.uDevice4;
                }
                _899 = _908;
            }
            _890 = _899;
        }
        _880 = _890;
    }
    return _880;
}

static inline __attribute__((always_inline))
float4 placeOf(thread const int& i, thread const int& n, thread const int& k, constant FlairUniforms& _117)
{
    float fi = float(i);
    float fn = float(n);
    if (_117.uLayout == 1)
    {
        float _945;
        if (((k == 2) || (k == 3)) || (k == 5))
        {
            _945 = 1.0;
        }
        else
        {
            float _951;
            if (k == 1)
            {
                _951 = 0.699999988079071044921875;
            }
            else
            {
                _951 = (k == 0) ? 0.5 : 0.319999992847442626953125;
            }
            _945 = _951;
        }
        float big = _945;
        float _963;
        if (fn <= 1.0)
        {
            _963 = 0.0;
        }
        else
        {
            _963 = ((fi / (fn - 1.0)) - 0.5) * 2.0;
        }
        float side = _963;
        float x = (side * 0.62000000476837158203125) * (1.0 - (0.3499999940395355224609375 * big));
        return float4(x, (-0.119999997317790985107421875) * (1.0 - big), big * 0.920000016689300537109375, 1.0 - big);
    }
    if (_117.uLayout == 2)
    {
        float _1000;
        if (fn <= 1.0)
        {
            _1000 = 0.5;
        }
        else
        {
            _1000 = fi / (fn - 1.0);
        }
        float t = _1000;
        return float4(mix(-0.449999988079071044921875, 0.449999988079071044921875, t), mix(0.180000007152557373046875, -0.180000007152557373046875, t), 0.7799999713897705078125, t);
    }
    float _1022;
    if (fn <= 1.0)
    {
        _1022 = 0.5;
    }
    else
    {
        _1022 = fi / (fn - 1.0);
    }
    float t_1 = _1022;
    float depth = 1.0 - (abs(t_1 - 0.5) * 2.0);
    float visible = (_117.iResolution[0u] / _117.iResolution[1u]) / _117.uSize;
    float x_1 = (t_1 - 0.5) * fast::min(0.550000011920928955078125 * fn, fast::max(0.0, visible - 0.89999997615814208984375));
    float y = (mod(fi, 2.0) - 0.5) * 0.119999997317790985107421875;
    return float4(x_1, y, 0.62000000476837158203125 + (0.25 * depth), depth);
}

static inline __attribute__((always_inline))
float depthOf(thread const int& i, thread const int& n, constant FlairUniforms& _117)
{
    int param = i;
    int param_1 = i;
    int param_2 = n;
    int param_3 = deviceOf(param, _117);
    return placeOf(param_1, param_2, param_3, _117).w + (float(i) * 0.001000000047497451305389404296875);
}

static inline __attribute__((always_inline))
float2 deviceSize(thread const int& k)
{
    float2 _307;
    if (k == 0)
    {
        _307 = float2(0.4900000095367431640625, 1.0);
    }
    else
    {
        float2 _315;
        if (k == 1)
        {
            _315 = float2(0.7599999904632568359375, 1.0);
        }
        else
        {
            float2 _324;
            if (k == 2)
            {
                _324 = float2(1.559999942779541015625, 1.0);
            }
            else
            {
                float2 _333;
                if (k == 3)
                {
                    _333 = float2(1.5, 1.0);
                }
                else
                {
                    _333 = select(float2(1.5, 1.0), float2(0.62000000476837158203125, 1.0), bool2(k == 4));
                }
                _324 = _333;
            }
            _315 = _324;
        }
        _307 = _315;
    }
    return _307;
}

static inline __attribute__((always_inline))
float4 over(thread const float4& acc, thread const float3& c, thread const float& a)
{
    return float4((acc.xyz * (1.0 - a)) + (c * a), (acc.w * (1.0 - a)) + a);
}

static inline __attribute__((always_inline))
float4 deviceScreen(thread const int& k)
{
    float4 _354;
    if (k == 0)
    {
        _354 = float4(0.0, 0.0, 0.2249999940395355224609375, 0.4799999892711639404296875);
    }
    else
    {
        float4 _362;
        if (k == 1)
        {
            _362 = float4(0.0, 0.0, 0.3449999988079071044921875, 0.4650000035762786865234375);
        }
        else
        {
            float4 _371;
            if (k == 2)
            {
                _371 = float4(0.0, 0.0599999986588954925537109375, 0.62000000476837158203125, 0.38999998569488525390625);
            }
            else
            {
                float4 _379;
                if (k == 3)
                {
                    _379 = float4(0.0, 0.119999997317790985107421875, 0.699999988079071044921875, 0.36000001430511474609375);
                }
                else
                {
                    _379 = select(float4(0.0, -0.0350000001490116119384765625, 0.730000019073486328125, 0.444999992847442626953125), float4(0.0, 0.0, 0.2199999988079071044921875, 0.2700000107288360595703125), bool4(k == 4));
                }
                _371 = _379;
            }
            _362 = _371;
        }
        _354 = _362;
    }
    return _354;
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
    float _405;
    if (k == 0)
    {
        _405 = 0.054999999701976776123046875;
    }
    else
    {
        float _412;
        if (k == 1)
        {
            _412 = 0.02999999932944774627685546875;
        }
        else
        {
            _412 = (k == 4) ? 0.0900000035762786865234375 : 0.008000000379979610443115234375;
        }
        _405 = _412;
    }
    return _405;
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
                float _549;
                if (k == 0)
                {
                    _549 = 0.07500000298023223876953125;
                }
                else
                {
                    _549 = (k == 1) ? 0.04500000178813934326171875 : 0.02999999932944774627685546875;
                }
                float2 param_23 = p;
                float2 param_24 = sz;
                float param_25 = _549;
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _117)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_117.uBackdrop) * _117.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_117.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _117)
{
    float4 _261;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _261 = overBackdrop(param, _117);
    }
    else
    {
        float2 param_1 = fract(uv);
        _261 = float4(testCard(param_1), 1.0);
    }
    return _261;
}

static inline __attribute__((always_inline))
float4 screenRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& suv, thread const float& aspect, constant FlairUniforms& _117)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    float2 uv = suv;
    bool _780 = ts.x > 1;
    bool _786;
    if (_780)
    {
        _786 = ts.y > 1;
    }
    else
    {
        _786 = _780;
    }
    if (_786)
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
    return pictureRGBA(tex, texSmplr, param, _117);
}

static inline __attribute__((always_inline))
float4 itemScreen(thread const int& i, thread const float2& suv, thread const float& aspect, constant FlairUniforms& _117, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr)
{
    if (i == 0)
    {
        float2 param = suv;
        float param_1 = aspect;
        return screenRGBA(uItem0, uItem0Smplr, param, param_1, _117);
    }
    if (i == 1)
    {
        float2 param_2 = suv;
        float param_3 = aspect;
        return screenRGBA(uItem1, uItem1Smplr, param_2, param_3, _117);
    }
    if (i == 2)
    {
        float2 param_4 = suv;
        float param_5 = aspect;
        return screenRGBA(uItem2, uItem2Smplr, param_4, param_5, _117);
    }
    if (i == 3)
    {
        float2 param_6 = suv;
        float param_7 = aspect;
        return screenRGBA(uItem3, uItem3Smplr, param_6, param_7, _117);
    }
    float2 param_8 = suv;
    float param_9 = aspect;
    return screenRGBA(uItem4, uItem4Smplr, param_8, param_9, _117);
}

static inline __attribute__((always_inline))
float4 finish(thread const float4& acc, constant FlairUniforms& _117)
{
    float4 base = float4(float3(_117.uBackground) * _117.uBackgroundAlpha, _117.uBackgroundAlpha);
    float4 o = float4(acc.xyz + (base.xyz * (1.0 - acc.w)), acc.w + (base.w * (1.0 - acc.w)));
    return float4(o.xyz / float3(fast::max(o.w, 9.9999997473787516355514526367188e-05)), o.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _117, texture2d<float> uItem0, sampler uItem0Smplr, texture2d<float> uItem1, sampler uItem1Smplr, texture2d<float> uItem2, sampler uItem2Smplr, texture2d<float> uItem3, sampler uItem3Smplr, texture2d<float> uItem4, sampler uItem4Smplr)
{
    float h = _117.iResolution[1u] * _117.uSize;
    float2 p = (fragCoord - (float2(_117.iResolution[0], _117.iResolution[1]) * 0.5)) / float2(h);
    float px = 1.5 / h;
    int n = clamp(_117.uCount, 1, 5);
    float4 acc = float4(0.0);
    spvUnsafeArray<float, 5> depths;
    float _1133;
    for (int j = 0; j < 5; j++)
    {
        if (j < n)
        {
            int param = j;
            int param_1 = n;
            _1133 = depthOf(param, param_1, _117);
        }
        else
        {
            _1133 = 99.0;
        }
        depths[j] = _1133;
    }
    float2 param_14;
    float param_15;
    for (int pass = 0; pass < 5; pass++)
    {
        if (pass >= n)
        {
            break;
        }
        int which = 0;
        for (int j_1 = 0; j_1 < 5; j_1++)
        {
            int r = 0;
            for (int m = 0; m < 5; m++)
            {
                r += int(depths[m] < depths[j_1]);
            }
            if ((j_1 < n) && (r == pass))
            {
                which = j_1;
            }
        }
        int param_2 = which;
        int k = deviceOf(param_2, _117);
        int param_3 = which;
        int param_4 = n;
        int param_5 = k;
        float4 place = placeOf(param_3, param_4, param_5, _117);
        float phase = (_117.iTime * _117.uSpeed) + (float(which) * 1.7000000476837158203125);
        float2 drift = (float2(0.0500000007450580596923828125 * sin(phase), 0.02999999932944774627685546875 * cos(phase * 0.800000011920928955078125)) * _117.uOrbit) * (0.4000000059604644775390625 + place.w);
        float2 q = ((p - place.xy) - drift) / float2(place.z);
        int param_6 = k;
        float shadow = exp((-powr(length((q - float2(0.0, -0.550000011920928955078125)) * float2(1.0 / fast::max(deviceSize(param_6).x, 0.4000000059604644775390625), 6.0)), 2.0)) * 2.0);
        float4 param_7 = acc;
        float3 param_8 = float3(0.0);
        float param_9 = (shadow * _117.uShadow) * 0.60000002384185791015625;
        acc = over(param_7, param_8, param_9);
        int param_10 = k;
        float2 param_11 = q;
        float3 param_12 = float3(_117.uBezel);
        float param_13 = px / place.z;
        float4 _1307 = deviceFrame(param_10, param_11, param_12, param_13, param_14, param_15);
        float2 suv = param_14;
        float screen = param_15;
        float4 frame = _1307;
        float4 param_16 = acc;
        float3 param_17 = frame.xyz;
        float param_18 = frame.w;
        acc = over(param_16, param_17, param_18);
        if (screen > 0.0)
        {
            int param_19 = k;
            float4 sr = deviceScreen(param_19);
            int param_20 = which;
            float2 param_21 = suv;
            float param_22 = sr.z / sr.w;
            float4 shot = itemScreen(param_20, param_21, param_22, _117, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr);
            float4 param_23 = acc;
            float3 param_24 = shot.xyz;
            float param_25 = screen * shot.w;
            acc = over(param_23, param_24, param_25);
        }
    }
    float4 param_26 = acc;
    fragColor = finish(param_26, _117);
}

fragment flair_device_showcase_frag_out flair_device_showcase_frag(constant FlairUniforms& _117 [[buffer(0)]], texture2d<float> uItem0 [[texture(1)]], texture2d<float> uItem1 [[texture(2)]], texture2d<float> uItem2 [[texture(3)]], texture2d<float> uItem3 [[texture(4)]], texture2d<float> uItem4 [[texture(5)]], sampler uItem0Smplr [[sampler(1)]], sampler uItem1Smplr [[sampler(2)]], sampler uItem2Smplr [[sampler(3)]], sampler uItem3Smplr [[sampler(4)]], sampler uItem4Smplr [[sampler(5)]], float4 gl_FragCoord [[position]])
{
    flair_device_showcase_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1366;
    if (_117.flair_flipY > 0.5)
    {
        _1366 = _117.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1366 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1366);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _117, uItem0, uItem0Smplr, uItem1, uItem1Smplr, uItem2, uItem2Smplr, uItem3, uItem3Smplr, uItem4, uItem4Smplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

