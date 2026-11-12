// flair-metal-hash: 78d54b15
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
    packed_float3 uColor;
    float uTint;
    float uSize;
    float uEdges;
    float uKey;
    float uRebuild;
    float uScanlines;
    float uLineSpacing;
    float uFlicker;
    float uGlitch;
    float uBeam;
    char _m24_pad[12];
    packed_float3 uBackground;
    float uBackgroundAlpha;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_hologram_frag_out
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
float3 holoBeam(thread const float2& p, thread const float2& base, thread const float& top, thread const float& width, constant FlairUniforms& _176)
{
    float3 col = float3(0.0);
    float up = (p.y - base.y) / fast::max(top - base.y, 0.001000000047497451305389404296875);
    if ((up > 0.0) && (up < 1.2000000476837158203125))
    {
        float spread = mix(width * 0.119999997317790985107421875, width, fast::clamp(up, 0.0, 1.0));
        float across = abs(p.x - base.x) / spread;
        float2 param = float2(((p.x - base.x) / spread) * 6.0, (up * 2.0) - (_176.iTime * 0.800000011920928955078125));
        float rays = 0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param));
        col += ((((float3(_176.uColor) * smoothstep(1.0, 0.60000002384185791015625, across)) * (1.0 - smoothstep(0.0, 1.14999997615814208984375, up))) * rays) * 0.2199999988079071044921875);
        col += (((float3(_176.uColor) * exp(((-across) * across) * 30.0)) * (1.0 - up)) * 0.119999997317790985107421875);
    }
    float2 e = (p - base) * float2(1.0, 3.599999904632568359375);
    float r = length(e);
    float rings = 0.0;
    for (int i = 0; i < 3; i++)
    {
        float ri = width * (0.180000007152557373046875 + (0.1599999964237213134765625 * float(i)));
        float d = abs((r - ri) - (0.0040000001899898052215576171875 * sin((_176.iTime * 3.0) + float(i))));
        rings += (exp(((-d) * d) / 6.0000002122251316905021667480469e-06) * (1.0 - (0.25 * float(i))));
    }
    col += (float3(_176.uColor) * (((rings * 0.89999997615814208984375) + (exp((-r) / (width * 0.119999997317790985107421875)) * 1.2000000476837158203125)) + (exp((-r) / (width * 0.5)) * 0.1500000059604644775390625)));
    return col;
}

static inline __attribute__((always_inline))
float2 holoGlitch(thread const float& v, constant FlairUniforms& _176)
{
    float k = floor(_176.iTime * 7.0);
    float2 param = float2(k, 3.2999999523162841796875);
    float on = step(1.0 - (0.449999988079071044921875 * _176.uGlitch), hash12(param));
    float2 param_1 = float2(k, 5.900000095367431640625);
    float bands = 5.0 + floor(14.0 * hash12(param_1));
    float band = floor(v * bands);
    float2 param_2 = float2(band, k + 0.5);
    float h = hash12(param_2);
    float hit = on * step(0.699999988079071044921875, h);
    float2 param_3 = float2(band, k + 9.1000003814697265625);
    return float2((((hash12(param_3) - 0.5) * 0.100000001490116119384765625) * _176.uGlitch) * hit, hit);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _176)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_176.uBackdrop) * _176.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_176.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _176)
{
    float4 _317;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _317 = overBackdrop(param, _176);
    }
    else
    {
        float2 param_1 = fract(uv);
        _317 = float4(testCard(param_1), 1.0);
    }
    return _317;
}

static inline __attribute__((always_inline))
float4 keyColour(constant FlairUniforms& _176, texture2d<float> uImage, sampler uImageSmplr)
{
    float4 k = float4(0.0);
    for (int i = 0; i < 4; i++)
    {
        float2 param = float2(((i == 1) || (i == 3)) ? 0.980000019073486328125 : 0.0199999995529651641845703125, (i >= 2) ? 0.980000019073486328125 : 0.0199999995529651641845703125);
        float4 c = pictureRGBA(uImage, uImageSmplr, param, _176);
        k += float4(c.xyz * c.w, c.w);
    }
    return float4(k.xyz / float3(fast::max(k.w, 9.9999997473787516355514526367188e-05)), k.w * 0.25);
}

static inline __attribute__((always_inline))
float4 lightAt(thread const float2& uv, thread const float4& key, constant FlairUniforms& _176, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float4 s = pictureRGBA(uImage, uImageSmplr, param, _176);
    float lum = fast::max(dot(s.xyz, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625)), 0.60000002384185791015625 * (1.0 - key.w));
    float3 c = mix(s.xyz, float3(_176.uColor) * (0.25 + (1.5 * lum)), float3(_176.uTint));
    float keep = mix(1.0, smoothstep(0.039999999105930328369140625, 0.039999999105930328369140625 + (0.300000011920928955078125 * _176.uKey), length(s.xyz - key.xyz)), step(0.001000000047497451305389404296875, _176.uKey) * key.w);
    return float4(c * (0.699999988079071044921875 + (1.39999997615814208984375 * lum)), s.w * keep);
}

static inline __attribute__((always_inline))
float holoScan(thread const float& y, constant FlairUniforms& _176)
{
    float s = 0.5 + (0.5 * sin(((y - (_176.iTime * 24.0)) * 6.28318023681640625) / _176.uLineSpacing));
    float r = (fract(((y / _176.iResolution[1u]) * 0.60000002384185791015625) - (_176.iTime * 0.180000007152557373046875)) * 8.0) - 4.0;
    float roll = exp((-r) * r) * 0.3499999940395355224609375;
    return (1.0 - ((_176.uScanlines * 0.75) * (1.0 - s))) * (1.0 + (roll * _176.uScanlines));
}

static inline __attribute__((always_inline))
float holoFlicker(constant FlairUniforms& _176)
{
    float k = floor(_176.iTime * 18.0);
    float2 param = float2(k, 1.2999999523162841796875);
    float dip = step(1.0 - (0.119999997317790985107421875 * _176.uFlicker), hash12(param)) * 0.64999997615814208984375;
    float2 param_1 = float2(k, 7.099999904632568359375);
    return (1.0 - (_176.uFlicker * ((0.119999997317790985107421875 * hash12(param_1)) + (0.0599999986588954925537109375 * sin(_176.iTime * 11.0))))) - dip;
}

static inline __attribute__((always_inline))
float4 holoOver(thread float3& light, constant FlairUniforms& _176)
{
    light = float3(1.0) - exp(-fast::max(light, float3(0.0)));
    float a = fast::max(light.x, fast::max(light.y, light.z));
    float3 col = ((float3(_176.uBackground) * _176.uBackgroundAlpha) * (1.0 - a)) + light;
    float alpha = _176.uBackgroundAlpha + (a * (1.0 - _176.uBackgroundAlpha));
    return float4(fast::min(col / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), float3(1.0)), alpha);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _176, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _176.iResolution[1u];
    float2 p = (fragCoord - (float2(_176.iResolution[0], _176.iResolution[1]) * 0.5)) * px;
    float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
    float _883;
    if (ts.y > 1.0)
    {
        _883 = ts.x / ts.y;
    }
    else
    {
        _883 = 1.0;
    }
    float aspect = _883;
    float h = fast::min(_176.uSize, ((_176.iResolution[0u] * px) * 0.920000016689300537109375) / aspect);
    float2 centre = float2(0.0, (((0.5 * (1.0 - h)) * 0.550000011920928955078125) - 0.0199999995529651641845703125) + (0.008000000379979610443115234375 * sin(_176.iTime * 1.2999999523162841796875)));
    float2 base = float2(0.0, -0.4699999988079071044921875);
    float2 param = p;
    float2 param_1 = base;
    float param_2 = centre.y + (0.100000001490116119384765625 * h);
    float param_3 = (h * aspect) * 0.5;
    float3 light = holoBeam(param, param_1, param_2, param_3, _176) * _176.uBeam;
    float2 uv = ((p - centre) / float2(h * aspect, h)) + float2(0.5);
    float param_4 = uv.y;
    float2 tear = holoGlitch(param_4, _176);
    uv.x += tear.x;
    float2 st = fast::clamp(uv, float2(0.0), float2(1.0));
    float4 key = keyColour(_176, uImage, uImageSmplr);
    float2 param_5 = st;
    float4 param_6 = key;
    float4 l = lightAt(param_5, param_6, _176, uImage, uImageSmplr);
    float3 c = l.xyz;
    float lum = dot(l.xyz, float3(0.333000004291534423828125));
    float edge = fast::clamp((length(float2(dfdx(lum), dfdy(lum))) * 6.0) + (length(float2(dfdx(l.w), dfdy(l.w))) * 2.5), 0.0, 1.0);
    if (tear.y > 0.5)
    {
        float2 param_7 = st + float2(0.01200000010430812835693359375, 0.0);
        float4 param_8 = key;
        float2 param_9 = st - float2(0.01200000010430812835693359375, 0.0);
        float4 param_10 = key;
        c = float3(lightAt(param_7, param_8, _176, uImage, uImageSmplr).x, c.y, lightAt(param_9, param_10, _176, uImage, uImageSmplr).z);
    }
    float fade = ((smoothstep(0.0, 0.0599999986588954925537109375, uv.x) * smoothstep(1.0, 0.939999997615814208984375, uv.x)) * smoothstep(0.0, 0.0500000007450580596923828125, uv.y)) * smoothstep(1.0, 0.949999988079071044921875, uv.y);
    float build = 1.0;
    if (_176.uRebuild > 0.0)
    {
        float line = ((mod(_176.iTime, _176.uRebuild) / fast::min(1.60000002384185791015625, _176.uRebuild * 0.5)) * 1.10000002384185791015625) - 0.0500000007450580596923828125;
        float k = (uv.y - line) * 90.0;
        build = smoothstep(line + 0.00999999977648258209228515625, line - 0.00999999977648258209228515625, uv.y);
        c += (((((float3(_176.uColor) * exp((-k) * k)) * 2.0) * step(line, 1.0499999523162841796875)) * step(0.0, uv.x)) * step(uv.x, 1.0));
    }
    light += ((((c * l.w) + ((float3(_176.uColor) * edge) * _176.uEdges)) * fade) * build);
    float param_11 = fragCoord.y;
    light *= (holoScan(param_11, _176) * holoFlicker(_176));
    float3 param_12 = light;
    float4 _1140 = holoOver(param_12, _176);
    fragColor = _1140;
}

fragment flair_hologram_frag_out flair_hologram_frag(constant FlairUniforms& _176 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_hologram_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1153;
    if (_176.flair_flipY > 0.5)
    {
        _1153 = _176.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1153 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1153);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _176, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

