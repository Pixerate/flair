// flair-metal-hash: 0b512754
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

// Implementation of the GLSL radians() function
template<typename T>
inline T radians(T d)
{
    return d * T(0.01745329251);
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
    float3 uTable;
    packed_float3 uFrame;
    float uTilt;
    uint uAuto;
    float uProgress;
    char _m18_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_polaroid_develop_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _157)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_157.uBackdrop) * _157.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_157.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _157)
{
    float4 _298;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _298 = overBackdrop(param, _157);
    }
    else
    {
        float2 param_1 = fract(uv);
        _298 = float4(testCard(param_1), 1.0);
    }
    return _298;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _157)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _157).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _157, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 res = float2(_157.iResolution[0], _157.iResolution[1]);
    float _357;
    if (_157.uAuto != 0u)
    {
        _357 = mod(_157.iTime, 7.0);
    }
    else
    {
        _357 = 3.0;
    }
    float t = _357;
    float _370;
    if (_157.uAuto != 0u)
    {
        _370 = smoothstep(0.800000011920928955078125, 5.0, t);
    }
    else
    {
        _370 = _157.uProgress;
    }
    float developed = _370;
    float _386;
    if (_157.uAuto != 0u)
    {
        _386 = 1.0 - powr(1.0 - fast::clamp(t / 0.800000011920928955078125, 0.0, 1.0), 3.0);
    }
    else
    {
        _386 = 1.0;
    }
    float slide = _386;
    float _401;
    if (_157.uAuto != 0u)
    {
        _401 = (sin((t - 0.800000011920928955078125) * 26.0) * exp((-(t - 0.800000011920928955078125)) * 2.2000000476837158203125)) * step(0.800000011920928955078125, t);
    }
    else
    {
        _401 = 0.0;
    }
    float shake = _401;
    float _425;
    if (_157.uAuto != 0u)
    {
        _425 = smoothstep(6.30000019073486328125, 7.0, t);
    }
    else
    {
        _425 = 0.0;
    }
    float gone = _425;
    float h = fast::min(res.y * 0.839999973773956298828125, (res.x * 0.839999973773956298828125) / 0.822000026702880859375);
    float2 hs = float2(h * 0.822000026702880859375, h) * 0.5;
    float2 centre = (res * 0.5) + float2((shake * h) * 0.0199999995529651641845703125, ((1.0 - slide) * ((res.y * 0.5) + h)) + ((gone * h) * 0.07999999821186065673828125));
    float ang = radians((_157.uTilt + (shake * 6.0)) + ((1.0 - slide) * 14.0));
    float2 p = fragCoord - centre;
    p = float2x2(float2(cos(ang), -sin(ang)), float2(sin(ang), cos(ang))) * p;
    float2 g = fragCoord / float2(res.y);
    float2 param = g * float2(3.0, 40.0);
    float3 col = (_157.uTable * (0.920000016689300537109375 + (0.07999999821186065673828125 * vnoise(param)))) * (1.0499999523162841796875 - (0.25 * length((fragCoord / res) - float2(0.5))));
    float lift = (1.0 - slide) + (abs(shake) * 0.4000000059604644775390625);
    float2 param_1 = p;
    float2 param_2 = hs;
    float param_3 = h * 0.008000000379979610443115234375;
    float sd = roundedBox(param_1, param_2, param_3);
    float2 param_4 = p - float2(h * 0.01200000010430812835693359375, (-h) * (0.017999999225139617919921875 + (0.0500000007450580596923828125 * lift)));
    float2 param_5 = hs;
    float param_6 = h * 0.0199999995529651641845703125;
    float shadowD = roundedBox(param_4, param_5, param_6);
    col *= (1.0 - ((0.37999999523162841796875 * (1.0 - smoothstep((-h) * 0.0199999995529651641845703125, h * (0.0500000007450580596923828125 + (0.07999999821186065673828125 * lift)), shadowD))) * (1.0 - gone)));
    float mask = (1.0 - smoothstep(-1.0, 1.0, sd)) * (1.0 - gone);
    if (mask > 0.0)
    {
        float2 param_7 = (p / float2(h)) * 60.0;
        float3 paper = float3(_157.uFrame) * (0.9700000286102294921875 + (0.02999999932944774627685546875 * vnoise(param_7)));
        float side = (hs.x * 2.0) * 0.06800000369548797607421875;
        float win = hs.x - side;
        float2 wc = float2(0.0, (hs.y - side) - win);
        float2 wp = p - wc;
        float2 param_8 = wp;
        float2 param_9 = float2(win);
        float param_10 = 1.0;
        float wsd = roundedBox(param_8, param_9, param_10);
        float3 face = paper;
        if (wsd < 1.0)
        {
            float2 uv = (wp / float2(2.0 * win)) + float2(0.5);
            float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
            float imageAspect = ts.x / fast::max(ts.y, 1.0);
            float2 _684;
            if (imageAspect > 1.0)
            {
                _684 = float2(1.0 / imageAspect, 1.0);
            }
            else
            {
                _684 = float2(1.0, imageAspect);
            }
            float2 fit = _684;
            float2 param_11 = float2(0.5) + ((uv - float2(0.5)) * fit);
            float3 pic = picture(uImage, uImageSmplr, param_11, _157);
            float2 param_12 = (uv * 3.0) + float2(7.0);
            float d = fast::clamp((developed * 1.2000000476837158203125) - (0.20000000298023223876953125 * vnoise(param_12)), 0.0, 1.0);
            float lum = dot(pic, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
            float3 ghost = mix(float3(0.1500000059604644775390625, 0.23000000417232513427734375, 0.25), float3(0.550000011920928955078125, 0.62999999523162841796875, 0.569999992847442626953125), float3(lum));
            float3 film = (mix(pic, float3(lum), float3(0.119999997317790985107421875)) * float3(1.0299999713897705078125, 0.9900000095367431640625, 0.930000007152557373046875)) + float3(0.02999999932944774627685546875);
            float3 shot = mix(float3(0.100000001490116119384765625, 0.1500000059604644775390625, 0.17000000178813934326171875), ghost, float3(smoothstep(0.0, 0.449999988079071044921875, d)));
            shot = mix(shot, film, float3(smoothstep(0.3499999940395355224609375, 1.0, d)));
            shot *= (1.0 - (0.25 * exp(wsd / (h * 0.006000000052154064178466796875))));
            face = mix(shot, paper, float3(smoothstep(-1.0, 1.0, wsd)));
        }
        col = mix(col, face, float3(mask));
    }
    fragColor = float4(col, 1.0);
}

fragment flair_polaroid_develop_frag_out flair_polaroid_develop_frag(constant FlairUniforms& _157 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_polaroid_develop_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _803;
    if (_157.flair_flipY > 0.5)
    {
        _803 = _157.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _803 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _803);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _157, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

