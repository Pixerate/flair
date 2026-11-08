// flair-metal-hash: 5c54754f
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
    float2 uEyeA;
    float2 uEyeB;
    packed_float3 uColor;
    float uAngle;
    float uSpread;
    float uLength;
    float uWidth;
    float uFlare;
    float uDarken;
    char _m22_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_laser_eyes_frag_out
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
float beam(thread const float2& p, thread const float2& e, thread const float& a, thread const float& flicker, constant FlairUniforms& _100)
{
    float2 dir = float2(cos(a), sin(a));
    float2 d = p - e;
    float along = dot(d, dir);
    float across = dot(d, float2(-dir.y, dir.x));
    float w = (_100.uWidth * (1.0 + (along * 0.800000011920928955078125))) * flicker;
    float on = step(0.0, along) * smoothstep(_100.uLength, _100.uLength * 0.75, along);
    float core = exp(-powr(across / (w * 0.3499999940395355224609375), 2.0));
    float glow = exp((-abs(across)) / (w * 2.5));
    return on * ((core * 1.39999997615814208984375) + (glow * 0.60000002384185791015625));
}

static inline __attribute__((always_inline))
float glint(thread const float2& p, thread const float2& c, thread const float& size, thread const float& turn)
{
    float2 d = p - c;
    float cs = cos(turn);
    float sn = sin(turn);
    d = float2((cs * d.x) + (sn * d.y), ((-sn) * d.x) + (cs * d.y)) / float2(size);
    float core = exp((-dot(d, d)) * 40.0);
    float streaks = (exp((-abs(d.y)) * 60.0) * exp((-abs(d.x)) * 2.2000000476837158203125)) + (exp((-abs(d.x)) * 60.0) * exp((-abs(d.y)) * 2.2000000476837158203125));
    return core + (0.699999988079071044921875 * streaks);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _100)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_100.uBackdrop) * _100.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_100.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _100)
{
    float4 _242;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _242 = overBackdrop(param, _100);
    }
    else
    {
        float2 param_1 = fract(uv);
        _242 = float4(testCard(param_1), 1.0);
    }
    return _242;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _100, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_100.iResolution[0], _100.iResolution[1]);
    float aspect = _100.iResolution[0u] / _100.iResolution[1u];
    float2 p = uv * float2(aspect, 1.0);
    float2 eA = _100.uEyeA * float2(aspect, 1.0);
    float2 eB = _100.uEyeB * float2(aspect, 1.0);
    float a = radians(_100.uAngle);
    float halfSpread = radians(_100.uSpread) * 0.5;
    float2 param = float2(floor(_100.iTime * 20.0), 3.0);
    float flick = 0.85000002384185791015625 + (0.1500000059604644775390625 * hash12(param));
    float2 param_1 = p;
    float2 param_2 = eA;
    float param_3 = a + (halfSpread * sign((eA.x - eB.x) + 9.9999997473787516355514526367188e-05));
    float param_4 = flick;
    float2 param_5 = p;
    float2 param_6 = eB;
    float param_7 = a - (halfSpread * sign((eA.x - eB.x) + 9.9999997473787516355514526367188e-05));
    float param_8 = flick;
    float light = beam(param_1, param_2, param_3, param_4, _100) + beam(param_5, param_6, param_7, param_8, _100);
    float size = (0.0900000035762786865234375 * _100.uFlare) * flick;
    float _524;
    if (_100.uFlare > 0.0)
    {
        float2 param_9 = p;
        float2 param_10 = eA;
        float param_11 = size;
        float param_12 = a;
        float2 param_13 = p;
        float2 param_14 = eB;
        float param_15 = size;
        float param_16 = a;
        _524 = glint(param_9, param_10, param_11, param_12) + glint(param_13, param_14, param_15, param_16);
    }
    else
    {
        _524 = 0.0;
    }
    float flare = _524;
    light += flare;
    float2 param_17 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_17, _100);
    float3 col = pic.xyz * (1.0 - _100.uDarken);
    col = mix(col, (col * float3(_100.uColor)) * 1.60000002384185791015625, float3(_100.uDarken * 0.4000000059604644775390625));
    col += (float3(_100.uColor) * light);
    col += (float3(1.0) * smoothstep(0.800000011920928955078125, 2.0, light));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, fast::clamp(light, 0.0, 1.0)));
}

fragment flair_laser_eyes_frag_out flair_laser_eyes_frag(constant FlairUniforms& _100 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_laser_eyes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _614;
    if (_100.flair_flipY > 0.5)
    {
        _614 = _100.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _614 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _614);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _100, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

