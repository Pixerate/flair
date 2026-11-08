// flair-metal-hash: 8f3871e5
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

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
    float uWidth;
    float uAngle;
    float uRefraction;
    float uFrost;
    float uHighlight;
    float uDispersion;
    float3 uTint;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_ribbed_glass_frag_out
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
float3 spectrum(thread const float& x)
{
    float3 d = (float3(x) - float3(0.20000000298023223876953125, 0.5, 0.800000011920928955078125)) / float3(0.300000011920928955078125);
    float3 c = fast::clamp(float3(1.0) - (d * d), float3(0.0), float3(1.0));
    c.x += (0.3499999940395355224609375 * fast::clamp(1.0 - (((x - 0.949999988079071044921875) * (x - 0.949999988079071044921875)) / 0.022500000894069671630859375), 0.0, 1.0));
    return c;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _132)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_132.uBackdrop) * _132.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_132.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _132)
{
    float4 _272;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _272 = overBackdrop(param, _132);
    }
    else
    {
        float2 param_1 = fract(uv);
        _272 = float4(testCard(param_1), 1.0);
    }
    return _272;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _132, texture2d<float> uImage, sampler uImageSmplr)
{
    float a = radians(_132.uAngle);
    float2 across = float2(cos(a), sin(a));
    float s = dot(fragCoord - (float2(_132.iResolution[0], _132.iResolution[1]) * 0.5), across) / _132.uWidth;
    float f = fract(s) - 0.5;
    float2 bend = ((((-across) * f) * _132.uWidth) * 3.0) * _132.uRefraction;
    float blur = _132.uFrost * 14.0;
    float2 param = fragCoord;
    float spin = hash12(param) * 6.28318023681640625;
    float3 sum = float3(0.0);
    float3 weight = float3(0.0);
    float alpha = 0.0;
    float3 _391;
    for (int i = 0; i < 9; i++)
    {
        float fi = float(i);
        float ang = (fi * 2.399960041046142578125) + spin;
        float2 o = float2(cos(ang), sin(ang)) * (blur * sqrt((fi + 0.5) / 9.0));
        float x = (fi + 0.5) / 9.0;
        if (_132.uDispersion > 0.0)
        {
            float param_1 = x;
            _391 = spectrum(param_1);
        }
        else
        {
            _391 = float3(1.0);
        }
        float3 w = _391;
        float2 param_2 = ((fragCoord + (bend * (1.0 + (_132.uDispersion * (x - 0.5))))) + o) / float2(_132.iResolution[0], _132.iResolution[1]);
        float4 c = pictureRGBA(uImage, uImageSmplr, param_2, _132);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    float4 pic = float4(sum / weight, alpha / 9.0);
    float3 col = pic.xyz * _132.uTint;
    col = mix(col, float3(dot(col, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625))) + float3(0.07999999821186065673828125), float3(_132.uFrost * 0.20000000298023223876953125));
    float hi = exp(-powr((f - 0.300000011920928955078125) * 12.0, 2.0));
    float lo = smoothstep(0.37999999523162841796875, 0.5, abs(f));
    col = (col * (1.0 - ((0.25 * lo) * _132.uHighlight))) + float3((hi * _132.uHighlight) * 0.3499999940395355224609375);
    fragColor = float4(col, pic.w);
}

fragment flair_ribbed_glass_frag_out flair_ribbed_glass_frag(constant FlairUniforms& _132 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_ribbed_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _517;
    if (_132.flair_flipY > 0.5)
    {
        _517 = _132.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _517 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _517);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _132, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

