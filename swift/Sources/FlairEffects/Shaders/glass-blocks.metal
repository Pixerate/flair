// flair-metal-hash: 898d5fc0
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
    float uSize;
    float uMortar;
    char _m15_pad[8];
    packed_float3 uMortarColor;
    float uRefraction;
    float uWave;
    float uDispersion;
    float uFrost;
    char _m20_pad[4];
    packed_float3 uTint;
    float uHighlight;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_glass_blocks_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _140)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_140.uBackdrop) * _140.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_140.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float4 pictureBlurRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float& blurPx, constant FlairUniforms& _140)
{
    float2 size = float2(int2(tex.get_width(), tex.get_height()));
    if (size.x <= 1.0)
    {
        float2 param = fract(uv);
        return float4(testCard(param), 1.0);
    }
    float4 param_1 = tex.sample(texSmplr, uv, level(log2(fast::max((blurPx * size.x) / _140.iResolution[0u], 1.0))));
    return overBackdrop(param_1, _140);
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
float4 dispersed(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& shift, thread const float& blurPx, constant FlairUniforms& _140)
{
    if (dot(shift, shift) < 9.9999999600419720025001879548654e-13)
    {
        float2 param = uv;
        float param_1 = blurPx;
        return pictureBlurRGBA(tex, texSmplr, param, param_1, _140);
    }
    float3 sum = float3(0.0);
    float3 weight = float3(0.0);
    float alpha = 0.0;
    for (int i = 0; i < 5; i++)
    {
        float x = (float(i) + 0.5) / 5.0;
        float param_2 = x;
        float3 w = spectrum(param_2);
        float2 param_3 = uv + (shift * (x - 0.5));
        float param_4 = blurPx;
        float4 c = pictureBlurRGBA(tex, texSmplr, param_3, param_4, _140);
        sum += (c.xyz * w);
        weight += w;
        alpha += c.w;
    }
    return float4(sum / weight, alpha / 5.0);
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _140, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 g = fragCoord / float2(_140.uSize);
    float2 cell = floor(g);
    float2 f = fract(g) - float2(0.5);
    float edge = 0.5 - fast::max(abs(f.x), abs(f.y));
    float mortar = 1.0 - smoothstep(0.5 * _140.uMortar, (0.5 * _140.uMortar) + (1.5 / _140.uSize), edge);
    float2 u = fast::clamp(f / float2(0.5 - (0.5 * _140.uMortar)), float2(-1.0), float2(1.0));
    float2 slope = (u * (-2.0)) * float2(1.0 - (u.y * u.y), 1.0 - (u.x * u.x));
    float rr = length(u);
    slope += ((u * ((_140.uWave * 0.60000002384185791015625) * cos(rr * 14.0))) / float2(fast::max(rr, 0.001000000047497451305389404296875)));
    float2 look = (((cell + float2(0.5)) * _140.uSize) + ((f * _140.uSize) * (1.0 - (1.2000000476837158203125 * _140.uRefraction)))) - (((slope * _140.uSize) * 0.119999997317790985107421875) * _140.uRefraction);
    float2 toUv = float2(1.0) / float2(_140.iResolution[0], _140.iResolution[1]);
    float2 param = look * toUv;
    float2 param_1 = (((slope * _140.uSize) * 0.100000001490116119384765625) * _140.uDispersion) * toUv;
    float param_2 = 1.0 + (_140.uFrost * 24.0);
    float4 seen = dispersed(uImage, uImageSmplr, param, param_1, param_2, _140);
    float3 glass = seen.xyz * float3(_140.uTint);
    float2 toLight = float2(-0.60000002384185791015625, 0.800000011920928955078125);
    glass *= (1.0 + ((0.25 * _140.uHighlight) * fast::clamp(-dot(slope, toLight), -1.0, 1.0)));
    float rim = smoothstep(0.7799999713897705078125, 0.980000019073486328125, fast::max(abs(u.x), abs(u.y)));
    glass += float3(((_140.uHighlight * 0.300000011920928955078125) * rim) * fast::clamp(0.5 - (0.5 * dot(fast::normalize(u + float2(9.9999997473787516355514526367188e-05)), toLight)), 0.0, 1.0));
    float2 param_3 = floor(fragCoord / float2(2.0));
    float3 mortarCol = float3(_140.uMortarColor) * (0.87999999523162841796875 + (0.119999997317790985107421875 * hash12(param_3)));
    mortarCol *= (1.0 - ((0.25 * smoothstep(0.5 * _140.uMortar, 0.0, edge)) * step(0.001000000047497451305389404296875, _140.uMortar)));
    float3 col = mix(glass, mortarCol, float3(mortar));
    fragColor = float4(col, fast::max(seen.w, mortar));
}

fragment flair_glass_blocks_frag_out flair_glass_blocks_frag(constant FlairUniforms& _140 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_glass_blocks_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _643;
    if (_140.flair_flipY > 0.5)
    {
        _643 = _140.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _643 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _643);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _140, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

