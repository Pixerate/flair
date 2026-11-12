// flair-metal-hash: 20aa142a
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
    float uPitch;
    float uSize;
    float uLevels;
    float uBloom;
    float uBrightness;
    float uDead;
    float uFlicker;
    uint uLouvres;
    float3 uBoard;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_led_wall_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
    float4 _237;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _237 = overBackdrop(param, _95);
    }
    else
    {
        float2 param_1 = fract(uv);
        _237 = float4(testCard(param_1), 1.0);
    }
    return _237;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _95)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _95).xyz;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float3 diode(thread const float2& cell, constant FlairUniforms& _95, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = ((cell + float2(0.5)) * _95.uPitch) / float2(_95.iResolution[0], _95.iResolution[1]);
    float3 c = picture(uImage, uImageSmplr, param, _95);
    float steps = _95.uLevels - 1.0;
    c = floor((c * steps) + float3(0.5)) / float3(steps);
    float2 param_1 = cell + float2(0.310000002384185791015625);
    float3 _302;
    if (hash12(param_1) < _95.uDead)
    {
        _302 = float3(0.0);
    }
    else
    {
        _302 = c * _95.uBrightness;
    }
    return _302;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _95, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 cell = floor(fragCoord / float2(_95.uPitch));
    float2 f = ((fragCoord / float2(_95.uPitch)) - cell) - float2(0.5);
    float r = _95.uSize * 0.5;
    float aa = 1.0 / _95.uPitch;
    float3 glow = float3(0.0);
    for (int y = -1; y <= 1; y++)
    {
        for (int x = -1; x <= 1; x++)
        {
            float2 o = float2(float(x), float(y));
            float2 d = f - o;
            float2 param = cell + o;
            glow += (diode(param, _95, uImage, uImageSmplr) * exp((-dot(d, d)) / ((r * r) * 2.5)));
        }
    }
    float2 param_1 = cell;
    float3 own = diode(param_1, _95, uImage, uImageSmplr);
    float2 param_2 = ((cell + float2(0.5)) * _95.uPitch) / float2(_95.iResolution[0], _95.iResolution[1]);
    float alpha = pictureRGBA(uImage, uImageSmplr, param_2, _95).w;
    float d_1 = length(f);
    float disc = smoothstep(r + aa, r - aa, d_1);
    float3 lens = float3(0.0500000007450580596923828125) + (own * (1.14999997615814208984375 - ((0.300000011920928955078125 * d_1) / r)));
    float3 col = mix(_95.uBoard, lens, float3(disc)) + ((glow * _95.uBloom) * 0.25);
    if (_95.uLouvres != 0u)
    {
        col = mix(col, _95.uBoard * 0.5, float3(smoothstep(0.36000001430511474609375, 0.4199999868869781494140625, f.y) * 0.85000002384185791015625));
    }
    float band = abs(fract((fragCoord.y / _95.iResolution[1u]) + (_95.iTime * 0.4000000059604644775390625)) - 0.5);
    col *= (1.0 - ((_95.uFlicker * 0.300000011920928955078125) * smoothstep(0.119999997317790985107421875, 0.0, band)));
    fragColor = float4(col, alpha);
}

fragment flair_image_led_wall_frag_out flair_image_led_wall_frag(constant FlairUniforms& _95 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_led_wall_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _514;
    if (_95.flair_flipY > 0.5)
    {
        _514 = _95.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _514 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _514);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _95, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

