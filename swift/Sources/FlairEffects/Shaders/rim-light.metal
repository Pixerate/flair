// flair-metal-hash: 1d037550
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    packed_float3 uColor;
    float uAngle;
    float uWidth;
    float uFocus;
    float uThreshold;
    float uIntensity;
    float uDim;
    uint uBrightSubject;
    char _m21_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_rim_light_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _68)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_68.uBackdrop) * _68.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_68.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float4 _212;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _212 = overBackdrop(param, _68);
    }
    else
    {
        float2 param_1 = fract(uv);
        _212 = float4(testCard(param_1), 1.0);
    }
    return _212;
}

static inline __attribute__((always_inline))
float luma(thread const float2& uv, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float4 c = pictureRGBA(uImage, uImageSmplr, param, _68);
    return dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)) * c.w;
}

static inline __attribute__((always_inline))
float2 gradient(thread const float2& uv, thread const float2& d, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv + float2(-d.x, d.y);
    float tl = luma(param, _68, uImage, uImageSmplr);
    float2 param_1 = uv + float2(0.0, d.y);
    float t = luma(param_1, _68, uImage, uImageSmplr);
    float2 param_2 = uv + d;
    float tr = luma(param_2, _68, uImage, uImageSmplr);
    float2 param_3 = uv - float2(d.x, 0.0);
    float l = luma(param_3, _68, uImage, uImageSmplr);
    float2 param_4 = uv + float2(d.x, 0.0);
    float r = luma(param_4, _68, uImage, uImageSmplr);
    float2 param_5 = uv - d;
    float bl = luma(param_5, _68, uImage, uImageSmplr);
    float2 param_6 = uv - float2(0.0, d.y);
    float b = luma(param_6, _68, uImage, uImageSmplr);
    float2 param_7 = uv + float2(d.x, -d.y);
    float br = luma(param_7, _68, uImage, uImageSmplr);
    return float2(((((tr + (2.0 * r)) + br) - tl) - (2.0 * l)) - bl, ((((tl + (2.0 * t)) + tr) - bl) - (2.0 * b)) - br) * 0.25;
}

static inline __attribute__((always_inline))
float rimAt(thread const float2& uv, thread const float2& d, thread const float2& toLight, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = uv;
    float2 param_1 = d;
    float2 g = gradient(param, param_1, _68, uImage, uImageSmplr);
    float s = length(g);
    float2 _363;
    if (_68.uBrightSubject != 0u)
    {
        _363 = -g;
    }
    else
    {
        _363 = g;
    }
    float2 n = _363 / float2(fast::max(s, 9.9999997473787516355514526367188e-06));
    float facing = mix(1.0, smoothstep(0.25, 0.949999988079071044921875, dot(n, toLight)), _68.uFocus);
    return smoothstep(_68.uThreshold, _68.uThreshold + 0.119999997317790985107421875, s) * facing;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_68.iResolution[0], _68.iResolution[1]);
    float a = radians(_68.uAngle);
    float2 toLight = float2(cos(a), sin(a));
    float2 d = float2(_68.uWidth) / float2(_68.iResolution[0], _68.iResolution[1]);
    float2 param = uv + (toLight * d);
    float2 param_1 = d;
    float2 param_2 = toLight;
    float crisp = rimAt(param, param_1, param_2, _68, uImage, uImageSmplr);
    float2 param_3 = uv + ((toLight * d) * 2.5);
    float2 param_4 = d * 3.0;
    float2 param_5 = toLight;
    float soft = rimAt(param_3, param_4, param_5, _68, uImage, uImageSmplr);
    float2 param_6 = uv + ((toLight * d) * 3.0);
    float2 param_7 = uv;
    float rise = luma(param_6, _68, uImage, uImageSmplr) - luma(param_7, _68, uImage, uImageSmplr);
    float _469;
    if (_68.uBrightSubject != 0u)
    {
        _469 = -rise;
    }
    else
    {
        _469 = rise;
    }
    float side = smoothstep(0.0, 0.0599999986588954925537109375, _469);
    crisp *= side;
    soft *= mix(0.5, 1.0, side);
    float2 param_8 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_8, _68);
    float3 light = ((float3(_68.uColor) * (crisp + (0.449999988079071044921875 * soft))) * _68.uIntensity) + ((((float3(1.0) * crisp) * crisp) * 0.119999997317790985107421875) * _68.uIntensity);
    float3 col = (pic.xyz * (1.0 - _68.uDim)) + (light * (float3(1.0) - (pic.xyz * 0.5)));
    fragColor = float4(col, pic.w);
}

fragment flair_rim_light_frag_out flair_rim_light_frag(constant FlairUniforms& _68 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_rim_light_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _548;
    if (_68.flair_flipY > 0.5)
    {
        _548 = _68.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _548 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _548);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _68, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

